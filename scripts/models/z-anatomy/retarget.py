"""CC BY-SA 4.0. Retarget CMU motion capture onto the fitted anatomy rig.

Input : source-assets/mocap/cmu/<subject>.asf, <trial>.amc   (CMU Graphics Lab
        Motion Capture Database, http://mocap.cs.cmu.edu — "may be copied,
        modified, or redistributed without permission"; funded by NSF EIA-0196217)
        .qa/rig/rig.json                                       (from rig.py)
Output: public/models/anatomy/anatomy-motion.json

Method: calibrated world-space rotation transfer. For every bone, the
performer's rotation relative to their own quiet standing pose (same subject)
is applied to this body's anatomical rest pose. Standing therefore reproduces
the anatomy exactly — natural spinal curves, clavicles and flat feet — and all
real movement (lean, swing, bend, twist) is carried over unchanged. CMU joint
chains are simplified (single-segment spine, marker-defined clavicle and
foot), so transferring their absolute directions would distort this skeleton.
Root height is solved per clip so the soles meet the floor during contact.
"""
import base64, json, re, sys
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation
from scipy.ndimage import gaussian_filter1d

SRC = Path('source-assets/mocap/cmu')
RIG = json.loads(Path('.qa/rig/rig.json').read_text())
OUT = Path('public/models/anatomy/anatomy-motion.json')
FPS = 30


# ---------------------------------------------------------------------------
# ASF / AMC
# ---------------------------------------------------------------------------
def parse_asf(path):
    text = Path(path).read_text()
    bones = {'root': dict(name='root', dir=np.zeros(3), length=0.0, C=np.eye(3), dof=[], parent=None)}
    sec = re.search(r':root(.*?):bonedata', text, re.S).group(1)
    raxis = re.search(r'orientation\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)', sec)
    bones['root']['C'] = Rotation.from_euler('xyz', [float(v) for v in raxis.groups()], degrees=True).as_matrix()
    bones['root']['order'] = re.search(r'order\s+([\w ]+)', sec).group(1).split()
    for block in re.findall(r'begin(.*?)end', text.split(':bonedata')[1].split(':hierarchy')[0], re.S):
        name = re.search(r'name\s+(\S+)', block).group(1)
        d = np.array([float(v) for v in re.search(r'direction\s+(\S+)\s+(\S+)\s+(\S+)', block).groups()])
        length = float(re.search(r'length\s+(\S+)', block).group(1))
        ax = re.search(r'axis\s+(\S+)\s+(\S+)\s+(\S+)\s+(\w+)', block)
        dof = re.search(r'dof\s+([\w ]+)', block)
        # ASF "axis ... XYZ": static X, then Y, then Z (matrix Rz·Ry·Rx).
        C = Rotation.from_euler('xyz', [float(ax.group(i)) for i in (1, 2, 3)], degrees=True).as_matrix()
        bones[name] = dict(name=name, dir=d / max(np.linalg.norm(d), 1e-9), length=length, C=C,
                           dof=dof.group(1).split() if dof else [], parent=None)
    for line in text.split(':hierarchy')[1].splitlines():
        parts = line.split()
        if not parts or parts[0] in ('begin', 'end'):
            continue
        for child in parts[1:]:
            bones[child]['parent'] = parts[0]
    order, seen = [], set()

    def visit(n):
        if n in seen:
            return
        p = bones[n]['parent']
        if p:
            visit(p)
        seen.add(n)
        order.append(n)
    for n in bones:
        visit(n)
    return bones, order


def parse_amc(path):
    frames, cur = [], None
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith(('#', ':')):
            continue
        if line.isdigit():
            cur = {}
            frames.append(cur)
            continue
        parts = line.split()
        cur[parts[0]] = [float(v) for v in parts[1:]]
    return frames


def fk(bones, order, frame):
    """Global rotation and start/end positions of every ASF bone for one frame."""
    G, start, end = {}, {}, {}
    root = bones['root']
    vals = dict(zip(root['order'], frame['root']))
    # CMU AMC Euler dofs compose as Rz·Ry·Rx (static XYZ), like the ASF axes.
    M = Rotation.from_euler('xyz', [vals.get('RX', 0), vals.get('RY', 0), vals.get('RZ', 0)], degrees=True).as_matrix()
    G['root'] = root['C'] @ M @ root['C'].T
    end['root'] = np.array([vals.get('TX', 0), vals.get('TY', 0), vals.get('TZ', 0)])
    start['root'] = end['root']
    for n in order:
        if n == 'root':
            continue
        b = bones[n]
        v = dict(zip(b['dof'], frame.get(n, [])))
        M = Rotation.from_euler('xyz', [v.get('rx', 0), v.get('ry', 0), v.get('rz', 0)], degrees=True).as_matrix()
        G[n] = G[b['parent']] @ (b['C'] @ M @ b['C'].T)
        start[n] = end[b['parent']]
        end[n] = start[n] + b['length'] * (G[n] @ b['dir'])
    return G, start, end


# ---------------------------------------------------------------------------
# Rig
# ---------------------------------------------------------------------------
TB = RIG['bones']
NAMES = [b['name'] for b in TB]
IDX = {n: i for i, n in enumerate(NAMES)}
HEAD = {b['name']: np.array(b['head']) for b in TB}
TAIL = {b['name']: np.array(b['tail']) for b in TB}
PARENT = {b['name']: b['parent'] for b in TB}

# target bone -> performer (ASF) segment whose rotation it follows
SOURCE = {'hips': 'root', 'spine': 'lowerback', 'chest': 'upperback', 'upperChest': 'thorax',
          'neck': 'lowerneck', 'head': 'head'}
for s_, m in (('L', 'l'), ('R', 'r')):
    SOURCE.update({f'clavicle{s_}': f'{m}clavicle', f'upperArm{s_}': f'{m}humerus', f'lowerArm{s_}': f'{m}radius',
                   f'hand{s_}': f'{m}hand', f'upperLeg{s_}': f'{m}femur', f'lowerLeg{s_}': f'{m}tibia',
                   f'foot{s_}': f'{m}foot', f'toes{s_}': f'{m}toes'})

# Quiet standing frame per performer: the calibration pose.
STANDING = {'143': ('143_25', 0), '75': ('75_20', 60), '93': ('93_03', 0)}


def performer_axes(bones, order):
    """Map the performer's world axes to model axes (+X left, +Y up, +Z forward)."""
    _, zs, ze = fk(bones, order, {n: [0] * 6 for n in bones})
    up = np.array([0, 1.0, 0])
    left = ze['lhipjoint'] - ze['rhipjoint']
    left -= (left @ up) * up
    left /= np.linalg.norm(left)
    fwd = np.cross(left, up)
    if (ze['lfoot'] - zs['lfoot']) @ fwd < 0:
        raise SystemExit('retarget: performer axes are mirrored')
    return np.stack([left, up, fwd])


def facing(Cv, G, en):
    """Heading correction so the pelvis faces +Z."""
    left = Cv @ (en['lhipjoint'] - en['rhipjoint'])
    up = Cv @ (G['root'] @ np.array([0, 1.0, 0]))
    f = np.cross(left, up)
    return Rotation.from_euler('y', -np.arctan2(f[0], f[2])).as_matrix()


def retarget(subject, trial, first, last, mode, repeats=1):
    bones, order = parse_asf(SRC / f'{subject}.asf')
    Cv = performer_axes(bones, order)
    ref_trial, ref_frame = STANDING[subject]
    Gref, _, enref = fk(bones, order, parse_amc(SRC / f'{ref_trial}.amc')[ref_frame])
    Aref = facing(Cv, Gref, enref) @ Cv
    frames = parse_amc(SRC / f'{trial}.amc')[first:last][::120 // FPS]
    legm = bones['lfemur']['length'] + bones['ltibia']['length']
    legt = np.linalg.norm(HEAD['lowerLegL'] - HEAD['upperLegL']) + np.linalg.norm(HEAD['footL'] - HEAD['lowerLegL'])
    scale = legt / legm

    rots, roots, mfeet = [], [], []
    A = None
    for fr in frames:
        G, _, en = fk(bones, order, fr)
        if A is None:
            A = facing(Cv, G, en) @ Cv
        world = {n: A @ G[SOURCE[n]] @ Gref[SOURCE[n]].T @ Aref.T for n in NAMES}
        local = []
        for n in NAMES:
            R = world[n] if PARENT[n] is None else world[PARENT[n]].T @ world[n]
            local.append(Rotation.from_matrix(R).as_quat())
        rots.append(local)
        roots.append(A @ en['root'])
        mfeet.append(min((A @ en[k])[1] for k in ('ltoes', 'rtoes', 'lfoot', 'rfoot', 'ltibia', 'rtibia')))
    rots = repair(np.array(rots))             # frames x bones x 4 (x, y, z, w)
    for b in range(rots.shape[1]):            # continuous quaternion signs
        for f in range(1, len(rots)):
            if rots[f, b] @ rots[f - 1, b] < 0:
                rots[f, b] *= -1
    roots = np.array(roots) * scale
    roots -= [roots[0, 0], 0, roots[0, 2]]
    # Horizontal travel: keep it for exits/entrances, otherwise keep only the
    # local stepping (removes drift so the figure stays on its turntable).
    if mode == 'inplace':
        for k in (0, 2):
            roots[:, k] -= gaussian_filter1d(roots[:, k], sigma=FPS * 0.8, mode='nearest')
    # Vertical: put the soles on the floor whenever the performer's feet are down.
    soles = np.array([sole_height(r) for r in rots])
    mfeet = np.array(mfeet) * scale
    contact = mfeet < np.percentile(mfeet, 10) + 0.02 * 2
    roots[:, 1] -= (roots[contact, 1] + soles[contact]).mean()
    if mode == 'cycle':
        rots, roots = tile_cycle(rots, roots, repeats)
        roots[:, [0, 2]] -= roots[:, [0, 2]].mean(0)
    return rots, roots


# Largest anatomically plausible deviation from the standing pose (degrees).
LIMITS = {'foot': 75, 'toes': 75, 'hand': 95}


def slerp(a, b, t):
    if a @ b < 0:
        b = -b
    d = np.clip(a @ b, -1, 1)
    if d > 0.9995:
        q = a + t * (b - a)
    else:
        th = np.arccos(d)
        q = (np.sin((1 - t) * th) * a + np.sin(t * th) * b) / np.sin(th)
    return q / np.linalg.norm(q)


def repair(rots):
    """Rebuild capture-solve errors: joints outside anatomical range (e.g. CMU
    inverting a foot while seated) and isolated one-frame spikes are replaced by
    slerp between the nearest valid frames."""
    rots = rots.copy()
    n = len(rots)
    for b, name in enumerate(NAMES):
        angle = np.degrees(2 * np.arccos(np.clip(np.abs(rots[:, b, 3]), 0, 1)))
        limit = next((v for k, v in LIMITS.items() if name.startswith(k)), None)
        bad = angle > limit if limit else np.zeros(n, bool)
        def dist(i, j):
            return 2 * np.degrees(np.arccos(min(1.0, abs(rots[i, b] @ rots[j, b]))))
        # Glitches of 1-3 frames that leave and return to the same pose.
        for length in (1, 2, 3):
            for f in range(1, n - length):
                if dist(f - 1, f + length) < 20 and max(dist(f - 1, k) for k in range(f, f + length)) > 40:
                    bad[f:f + length] = True
        # A solver flip ramps in over a couple of frames: widen each bad span
        # so interpolation starts from genuinely clean frames.
        bad = np.convolve(bad.astype(int), np.ones(5, int), mode='same') > 0
        f = 0
        while f < n:
            if not bad[f]:
                f += 1
                continue
            g = f
            while g < n and bad[g]:
                g += 1
            a = rots[f - 1, b] if f > 0 else None
            c = rots[g, b] if g < n else None
            if a is None and c is None:
                rots[:, b] = [0, 0, 0, 1]
            for k in range(f, g):
                if a is None:
                    rots[k, b] = c
                elif c is None:
                    rots[k, b] = a
                else:
                    rots[k, b] = slerp(a, c, (k - f + 1) / (g - f + 1))
            f = g
    return rots


def tile_cycle(rots, roots, repeats):
    """Find the most seamless single gait cycle and repeat it in place."""
    n = len(rots)
    best = (np.inf, 0, n - 1)
    for i in range(n):
        for j in range(i + int(FPS * 0.45), min(n, i + int(FPS * 1.0))):
            cost = np.sum(1 - np.abs(np.sum(rots[i] * rots[j], axis=1)))
            if cost < best[0]:
                best = (cost, i, j)
    _, i, j = best
    cyc_r, cyc_p = rots[i:j].copy(), roots[i:j].copy()
    drift = roots[j] - roots[i]
    ramp = np.linspace(0, 1, j - i, endpoint=False)[:, None]
    cyc_p[:, [0, 2]] -= ramp * drift[[0, 2]]
    cyc_p[:, 1] -= ramp[:, 0] * drift[1]
    out_r = np.concatenate([cyc_r] * repeats)
    for b in range(out_r.shape[1]):
        for f in range(1, len(out_r)):
            if out_r[f, b] @ out_r[f - 1, b] < 0:
                out_r[f, b] *= -1
    return out_r, np.concatenate([cyc_p] * repeats)


def sole_height(q):
    """Lowest sole point relative to the hips joint for one pose."""
    world_r = {}
    world_p = {}
    for i, n in enumerate(NAMES):
        R = Rotation.from_quat(q[i]).as_matrix()
        if PARENT[n] is None:
            world_r[n] = R
            world_p[n] = np.zeros(3)
        else:
            p = PARENT[n]
            world_r[n] = world_r[p] @ R
            world_p[n] = world_p[p] + world_r[p] @ (HEAD[n] - HEAD[p])
    pts = []
    for s in 'LR':
        ankle = world_p[f'foot{s}']
        ball = world_p[f'toes{s}']
        tip = world_p[f'toes{s}'] + world_r[f'toes{s}'] @ (TAIL[f'toes{s}'] - HEAD[f'toes{s}'])
        pts += [ankle[1] - HEAD[f'foot{s}'][1], ball[1] - HEAD[f'toes{s}'][1], tip[1] - TAIL[f'toes{s}'][1]]
    return min(pts)


def encode(rots, roots):
    """Compact rotations: w >= 0 is implied, x/y/z int16 delta-coded per channel over time."""
    q = np.clip(np.round(rots * 32767), -32767, 32767).astype(np.int32)
    q = np.where(q[..., 3:4] < 0, -q, q)[..., :3]
    q = np.transpose(q, (1, 2, 0))                       # bone, channel, frame
    d = np.diff(q, axis=2, prepend=0).astype('<i2')      # int16 wrap-around is decoded symmetrically
    return (base64.b64encode(d.tobytes()).decode(), base64.b64encode(roots.astype('<f4').tobytes()).decode())


if __name__ == '__main__':
    plan = json.loads(Path(sys.argv[1]).read_text())
    clips = []
    for c in plan['clips']:
        rots, roots = retarget(c['subject'], c['trial'], c['from'], c['to'], c['mode'], c.get('repeats', 1))
        r, p = encode(rots, roots)
        clips.append(dict(name=c['name'], source=f"CMU {c['trial']}", mode=c['mode'], frames=len(rots), rotations=r, root=p))
        print(c['name'], len(rots), 'frames', 'travel', np.round(roots[-1] - roots[0], 3), 'y', np.round([roots[:, 1].min(), roots[:, 1].max()], 3))
    OUT.write_text(json.dumps(dict(
        license='Motion: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), free to copy/modify/redistribute; '
                'created with funding from NSF EIA-0196217. Retargeted to the CC BY-SA 4.0 anatomy rig.',
        format='xyz-delta', fps=FPS, bones=NAMES, rest={n: HEAD[n].round(5).tolist() for n in NAMES}, clips=clips), separators=(',', ':')) + '\n')
    print(OUT, OUT.stat().st_size, 'bytes')
