"""CC BY-SA 4.0. Fit a humanoid rig to the aligned Z-Anatomy layers and skin them.

Input : .qa/rig/<layer>[-low].pos.f32 / .idx.u32  (from rig-export.mjs)
Output: .qa/rig/<layer>[-low].joints.u8 / .weights.u8  (4 influences / vertex)
        .qa/rig/rig.json                                (bone heads/tails, model space)
        public/models/anatomy/anatomy-rig.json          (runtime rig)

Joint centres are measured from the skeleton layer itself (femoral and humeral
heads, condyles, malleoli, intervertebral discs, sternoclavicular ends), so the
rig matches this body rather than generic proportions.

Every layer is weighted by the SAME position-only function, so skin, muscles
and nerves at one point in space deform identically and stay aligned. Bones
are additionally bound rigidly per connected piece, as real bones are.
Model space: +Y up, +Z anterior, +X is the subject's left. Height = 2 units.
"""
import json, sys
from pathlib import Path
import numpy as np
import scipy.sparse as sp
from scipy.sparse.csgraph import connected_components

QA = Path('.qa/rig')
PUBLIC = Path('public/models/anatomy')
LAYERS = ['base', 'skeleton', 'muscles', 'nervous']


def load(name):
    p = np.fromfile(QA / f'{name}.pos.f32', np.float32).reshape(-1, 3).astype(np.float64)
    i = np.fromfile(QA / f'{name}.idx.u32', np.uint32).reshape(-1, 3)
    return p, i


def components(p, idx):
    key = np.round(p / 1e-5).astype(np.int64)
    _, uid = np.unique(key, axis=0, return_inverse=True)
    uid = uid.ravel()
    e = uid[np.concatenate([idx[:, [0, 1]], idx[:, [1, 2]], idx[:, [0, 2]]])]
    n = uid.max() + 1
    g = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n))
    _, lab = connected_components(g, directed=False)
    return lab[uid]


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------------------
# 1. Measure joint centres on the skeleton layer
# ---------------------------------------------------------------------------
sp_, si = load('skeleton')
labels = components(sp_, si)
comps = []
for c in range(labels.max() + 1):
    pts = sp_[labels == c]
    comps.append(dict(id=c, n=len(pts), mean=pts.mean(0), min=pts.min(0), max=pts.max(0), pts=pts))


def find(pred, key):
    found = [c for c in comps if pred(c)]
    if not found:
        raise SystemExit('rig: landmark component not found')
    return max(found, key=key)


def ext(c):
    return c['max'] - c['min']


def long_bone(side, y0, y1, minlen):
    """Longest component on one side whose vertical span lies in [y0, y1]."""
    return find(lambda c: np.sign(c['mean'][0]) == side and abs(c['mean'][0]) > 0.03
                and c['min'][1] > y0 and c['max'][1] < y1 and ext(c)[1] > minlen,
                key=lambda c: ext(c)[1] * c['n'] ** 0.1)


def end_mean(pts, top, band, medial=None):
    y = pts[:, 1]
    sel = pts[(y > y.max() - band)] if top else pts[(y < y.min() + band)]
    if medial is not None and len(sel) > 8:
        ax = np.abs(sel[:, 0])
        sel = sel[ax <= np.percentile(ax, medial)]
    return sel.mean(0)


J = {}
for side, s in (('L', 1), ('R', -1)):
    femur = long_bone(s, 0.45, 1.1, 0.4)
    tibia = find(lambda c: np.sign(c['mean'][0]) == s and c['min'][1] > 0.05 and c['max'][1] < 0.55
                 and ext(c)[1] > 0.35 and ext(c)[0] > 0.06, key=lambda c: c['n'])
    fibula = find(lambda c: np.sign(c['mean'][0]) == s and c['min'][1] > 0.04 and c['max'][1] < 0.55
                  and ext(c)[1] > 0.35 and ext(c)[0] < 0.06, key=lambda c: c['n'])
    humerus = long_bone(s, 1.2, 1.7, 0.3)
    fore = [c for c in comps if np.sign(c['mean'][0]) == s and c['min'][1] > 0.95 and c['max'][1] < 1.35
            and ext(c)[1] > 0.22 and abs(c['mean'][0]) > 0.2]
    if len(fore) != 2:
        raise SystemExit('rig: expected radius and ulna')
    clav = find(lambda c: np.sign(c['mean'][0]) == s and 1.58 < c['mean'][1] < 1.7 and ext(c)[0] > 0.12
                and ext(c)[1] < 0.06, key=lambda c: c['n'])
    J[f'hip{side}'] = end_mean(femur['pts'], True, 0.07, medial=35)
    J[f'knee{side}'] = (end_mean(femur['pts'], False, 0.025) + end_mean(tibia['pts'], True, 0.02)) / 2
    J[f'ankle{side}'] = (end_mean(tibia['pts'], False, 0.02) + end_mean(fibula['pts'], False, 0.02)) / 2 + [0, 0.012, 0]
    J[f'shoulder{side}'] = end_mean(humerus['pts'], True, 0.05, medial=40)
    J[f'elbow{side}'] = (end_mean(humerus['pts'], False, 0.03)
                        + np.mean([end_mean(c['pts'], True, 0.02) for c in fore], 0)) / 2
    J[f'wrist{side}'] = np.mean([end_mean(c['pts'], False, 0.015) for c in fore], 0)
    cp = clav['pts']
    J[f'sc{side}'] = cp[np.abs(cp[:, 0]) < np.abs(cp[:, 0]).min() + 0.015].mean(0)
    # Foot: low skeleton points on this side; ball of foot at ~73% heel→toe.
    foot = sp_[(sp_[:, 1] < J[f'ankle{side}'][1] - 0.01) & (np.sign(sp_[:, 0]) == s) & (np.abs(sp_[:, 0]) > 0.04)]
    z0, z1 = foot[:, 2].min(), foot[:, 2].max()
    zb = z0 + 0.73 * (z1 - z0)
    band = foot[np.abs(foot[:, 2] - zb) < 0.015]
    J[f'ball{side}'] = np.array([band[:, 0].mean(), 0.025, zb])
    tip = foot[foot[:, 2] > z1 - 0.012]
    J[f'toe{side}'] = np.array([tip[:, 0].mean(), 0.015, z1])
    # Hand tip: lowest hand-bone points on this side.
    hand = sp_[(np.sign(sp_[:, 0]) == s) & (np.abs(sp_[:, 0]) > 0.2) & (sp_[:, 1] < J[f'wrist{side}'][1] - 0.01)]
    low = hand[hand[:, 1] < hand[:, 1].min() + 0.01]
    J[f'tip{side}'] = low.mean(0)

# Spine: intervertebral disc / joint levels from the midline column.
column = sorted([c for c in comps if abs(c['mean'][0]) < 0.02 and ext(c)[0] < 0.2 and c['mean'][2] < 0.02
                 and 0.95 < c['mean'][1] < 1.83 and c['n'] > 30], key=lambda c: c['mean'][1])


def disc_near(y):
    c = min(column, key=lambda c: abs(c['mean'][1] - y))
    return c['mean'].copy()


J['root'] = (J['hipL'] + J['hipR']) / 2
J['l5s1'] = disc_near(1.126)
J['t12l1'] = disc_near(1.325)
J['t6t7'] = disc_near(1.532)
J['c7t1'] = disc_near(1.692)
atlas = find(lambda c: abs(c['mean'][0]) < 0.01 and 1.79 < c['mean'][1] < 1.82 and ext(c)[0] > 0.08, key=lambda c: c['n'])
J['c1'] = atlas['mean'] + [0, atlas['max'][1] - atlas['mean'][1], 0]
J['top'] = np.array([0.0, sp_[:, 1].max(), J['c1'][2] + 0.03])

# Bone list: name, parent, head joint, tail joint.
BONES = [('hips', None, 'root', 'l5s1'), ('spine', 'hips', 'l5s1', 't12l1'),
         ('chest', 'spine', 't12l1', 't6t7'), ('upperChest', 'chest', 't6t7', 'c7t1'),
         ('neck', 'upperChest', 'c7t1', 'c1'), ('head', 'neck', 'c1', 'top')]
for s in 'LR':
    BONES += [(f'clavicle{s}', 'upperChest', f'sc{s}', f'shoulder{s}'),
              (f'upperArm{s}', f'clavicle{s}', f'shoulder{s}', f'elbow{s}'),
              (f'lowerArm{s}', f'upperArm{s}', f'elbow{s}', f'wrist{s}'),
              (f'hand{s}', f'lowerArm{s}', f'wrist{s}', f'tip{s}'),
              (f'upperLeg{s}', 'hips', f'hip{s}', f'knee{s}'),
              (f'lowerLeg{s}', f'upperLeg{s}', f'knee{s}', f'ankle{s}'),
              (f'foot{s}', f'lowerLeg{s}', f'ankle{s}', f'ball{s}'),
              (f'toes{s}', f'foot{s}', f'ball{s}', f'toe{s}')]
NAMES = [b[0] for b in BONES]
B = {n: i for i, n in enumerate(NAMES)}

# ---------------------------------------------------------------------------
# 2. Position-only weighting function (shared by every layer)
# ---------------------------------------------------------------------------
GAP = np.array([[0.70, 0.25], [1.06, 0.25], [1.09, 0.235], [1.21, 0.202], [1.30, 0.195],
                [1.35, 0.19], [1.66, 0.15]])


def arm_boundary(y):
    return np.interp(y, GAP[:, 0], GAP[:, 1])


def chain_param(p, pts):
    """Arclength coordinate of each point projected onto a polyline."""
    best = np.full(len(p), np.inf)
    s = np.zeros(len(p))
    acc = 0.0
    for a, b in zip(pts[:-1], pts[1:]):
        d = b - a
        L = np.linalg.norm(d)
        t = np.clip(((p - a) @ d) / (L * L), 0, 1)
        dist = np.linalg.norm(p - (a + t[:, None] * d), axis=1)
        m = dist < best
        best[m] = dist[m]
        s[m] = acc + t[m] * L
        acc += L
    return s


def seglen(*keys):
    return float(sum(np.linalg.norm(J[b] - J[a]) for a, b in zip(keys[:-1], keys[1:])))


def weights(p):
    n = len(p)
    W = np.zeros((n, len(NAMES)))
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    ax = np.abs(x)
    # Region memberships.
    arm = np.where((y > 0.72) & (y < 1.68), smooth(-0.02, 0.02, ax - arm_boundary(y)), 0.0)
    crease = 0.93 + ax * (0.15 / 0.21)
    leg = smooth(-0.03, 0.03, crease - y) * (1 - arm)
    torso = 1 - arm - leg
    # Torso chain by height; the head plane drops forward to include the chin.
    lv = [J['l5s1'][1], J['t12l1'][1], J['t6t7'][1], J['c7t1'][1]]
    head_y = J['c1'][1] - 0.6 * np.maximum(z - J['c1'][2], 0)
    hw = [0.03, 0.04, 0.04, 0.025]
    seg = np.zeros((n, 6))
    acc = np.ones(n)
    cuts = [smooth(lv[k] - hw[k], lv[k] + hw[k], y) for k in range(4)] + [smooth(-0.02, 0.02, y - head_y)]
    for k, c in enumerate(cuts):
        seg[:, k] = acc * (1 - c)
        acc = acc * c
    seg[:, 5] = acc
    # Shoulder girdle: the top of each shoulder follows its clavicle.
    girdle = torso * smooth(0.06, 0.13, ax) * smooth(1.56, 1.63, y) * (1 - smooth(1.70, 1.74, y))
    for k, name in enumerate(['hips', 'spine', 'chest', 'upperChest', 'neck', 'head']):
        W[:, B[name]] += (torso - girdle) * seg[:, k]
    for s, sg in (('L', 1), ('R', -1)):
        side = smooth(-0.015, 0.015, sg * x)
        W[:, B[f'clavicle{s}']] += girdle * side
        # Arm chain.
        a = arm * side
        sa = chain_param(p, [J[f'shoulder{s}'], J[f'elbow{s}'], J[f'wrist{s}'], J[f'tip{s}']])
        le, lw = seglen(f'shoulder{s}', f'elbow{s}'), seglen(f'shoulder{s}', f'elbow{s}', f'wrist{s}')
        fore = smooth(le - 0.035, le + 0.035, sa)
        hand = smooth(lw - 0.015, lw + 0.02, sa)
        W[:, B[f'upperArm{s}']] += a * (1 - fore)
        W[:, B[f'lowerArm{s}']] += a * fore * (1 - hand)
        W[:, B[f'hand{s}']] += a * hand
        # Leg chain.
        l = leg * side
        sl = chain_param(p, [J[f'hip{s}'], J[f'knee{s}'], J[f'ankle{s}']])
        lk = seglen(f'hip{s}', f'knee{s}')
        shin = smooth(lk - 0.04, lk + 0.04, sl)
        footw = smooth(J[f'ankle{s}'][1] + 0.025, J[f'ankle{s}'][1] - 0.035, y)
        toes = smooth(J[f'ball{s}'][2] - 0.012, J[f'ball{s}'][2] + 0.012, z) * footw
        W[:, B[f'upperLeg{s}']] += l * (1 - shin) * (1 - footw)
        W[:, B[f'lowerLeg{s}']] += l * shin * (1 - footw)
        W[:, B[f'foot{s}']] += l * (footw - toes)
        W[:, B[f'toes{s}']] += l * toes
    W = np.clip(W, 0, None)
    total = W.sum(1, keepdims=True)
    W = np.where(total > 1e-6, W / np.maximum(total, 1e-9), np.eye(len(NAMES))[B['hips']])
    return W


def pack(W):
    """Top-4 influences, uint8 weights summing exactly to 255."""
    order = np.argsort(-W, axis=1)[:, :4]
    w = np.take_along_axis(W, order, 1)
    w = w / np.maximum(w.sum(1, keepdims=True), 1e-9)
    q = np.floor(w * 255 + 0.5).astype(np.int32)
    q[:, 0] += 255 - q.sum(1)
    order = np.where(q > 0, order, 0)
    return order.astype(np.uint8), q.astype(np.uint8)


# Pieces of the skeleton that must stay with a specific bone regardless of
# which side of a soft-tissue boundary most of their vertices fall.
def forced_bone(c):
    m, e = c['mean'], ext(c)
    if abs(m[0]) < 0.16 and 0.88 < m[1] < 1.2 and (e[1] > 0.1 or abs(m[0]) < 0.02) and m[2] < 0.05:
        return 'hips'                                   # hip bones, sacrum, coccyx
    if 0.06 < abs(m[0]) < 0.2 and 1.38 < m[1] < 1.66 and m[2] < -0.03 and e[1] > 0.1:
        return 'clavicle' + ('L' if m[0] > 0 else 'R')  # scapulae
    if 1.58 < m[1] < 1.7 and e[0] > 0.12 and e[1] < 0.06:
        return 'clavicle' + ('L' if m[0] > 0 else 'R')  # clavicles
    return None


report = {}
for layer in LAYERS:
    for tier in ('', '-low'):
        name = layer + tier
        p, idx = load(name)
        W = weights(p)
        if layer == 'skeleton':
            lab = components(p, idx)
            rigid = smooth_kept = 0
            for c in range(lab.max() + 1):
                m = lab == c
                pts = p[m]
                info = dict(mean=pts.mean(0), min=pts.min(0), max=pts.max(0))
                forced = forced_bone(info)
                if forced:
                    bone = B[forced]
                else:
                    share = W[m].sum(0)
                    bone = int(share.argmax())
                    if share[bone] / share.sum() < 0.6:
                        smooth_kept += 1        # straddles a joint (patella, long ligaments): keep blended
                        continue
                W[m] = 0
                W[m, bone] = 1
                rigid += 1
            report[name] = dict(rigidPieces=rigid, blendedPieces=smooth_kept)
        j, w = pack(W)
        j.tofile(QA / f'{name}.joints.u8')
        w.tofile(QA / f'{name}.weights.u8')
        dom = np.bincount(j[:, 0], minlength=len(NAMES))
        report.setdefault(name, {})['dominant'] = {NAMES[k]: int(v) for k, v in enumerate(dom) if v}
        report[name]['vertices'] = len(p)

rig = dict(units='model space (+Y up, +Z anterior, +X subject left; height 2)',
           bones=[dict(name=n, parent=par, head=J[h].round(5).tolist(), tail=J[t].round(5).tolist())
                  for n, par, h, t in BONES])
(QA / 'rig.json').write_text(json.dumps(dict(rig, joints={k: v.round(5).tolist() for k, v in J.items()}, report=report), indent=1))
(PUBLIC / 'anatomy-rig.json').write_text(json.dumps(dict(
    license='CC-BY-SA-4.0', note='Rig fitted to the Z-Anatomy layers by scripts/models/z-anatomy/rig.py',
    bones=[dict(name=b['name'], parent=b['parent'], head=b['head']) for b in rig['bones']]), separators=(',', ':')) + '\n')
for k, v in J.items():
    print(f'{k:10s}', np.round(v, 3))
print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk != 'dominant'} for k, v in report.items()}))
