import "./env";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { SCHEMA_SQL } from "./migrate-postgres";
import { databaseConfig } from "../src/lib/database-config";

// Explicit initialization only. The transaction lock serializes concurrent runs.
export async function seedDatabase() {
  const pool = new Pool(databaseConfig());
  const client = await pool.connect();
  // Stable seed identities preserve records even after their title or slug is edited.
  // Missing/deleted records can still be recovered by explicit reseeding.
  const query = async (sql: string, params: unknown[] = []) => {
    const match = sql.match(
      /^INSERT INTO (research_themes|projects|publications|patents|theses|timeline|posts|project_media) [\s\S]+ WHERE NOT EXISTS \(SELECT 1 FROM \w+ WHERE ([\s\S]+)\)$/,
    );
    if (!match) {
      if (sql === "SELECT id FROM projects WHERE slug = $1") {
        return client.query(
          "SELECT id FROM projects WHERE slug=$1 UNION SELECT p.id FROM projects p JOIN seed_records s ON s.record_id=p.id WHERE s.seed_key=$2 LIMIT 1",
          [params[0], "projects:" + JSON.stringify([params[0]])],
        );
      }
      return client.query(sql, params);
    }
    const [, table, where] = match;
    const values = [...where.matchAll(/\$(\d+)/g)].map(
      (m) => params[Number(m[1]) - 1],
    );
    const key = table + ":" + JSON.stringify(values);
    const tracked = await client.query(
      `SELECT t.id FROM ${table} t JOIN seed_records s ON s.record_id=t.id WHERE s.seed_key=$1`,
      [key],
    );
    if (tracked.rowCount) return tracked;
    const result = await client.query(sql + " RETURNING id", params);
    let parameter = 0;
    const identityWhere = where.replace(/\$\d+/g, () => "$" + ++parameter);
    const identity =
      result.rows[0] ||
      (
        await client.query(
          `SELECT id FROM ${table} WHERE ${identityWhere}`,
          values,
        )
      ).rows[0];
    if (identity)
      await client.query(
        "INSERT INTO seed_records (seed_key,record_id) VALUES ($1,$2) ON CONFLICT(seed_key) DO UPDATE SET record_id=excluded.record_id",
        [key, identity.id],
      );
    return result;
  };
  try {
    await query("BEGIN");
    await query("SELECT pg_advisory_xact_lock(7102026)");
    console.log("🌱 Seeding PostgreSQL database with research data...");

    // Apply schema first (idempotent: CREATE TABLE / INDEX IF NOT EXISTS).
    await query(SCHEMA_SQL);
    await query(
      "CREATE TABLE IF NOT EXISTS seed_records (seed_key TEXT PRIMARY KEY, record_id BIGINT NOT NULL)",
    );
    console.log("✅ Schema is up to date");

    // --- Admin User ---
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail) {
      throw new Error(
        "ADMIN_EMAIL environment variable is required but not set",
      );
    }
    if (!adminPassword) {
      throw new Error(
        "ADMIN_PASSWORD environment variable is required but not set",
      );
    }
    if (adminPassword.length < 12 || Buffer.byteLength(adminPassword) > 72) {
      throw new Error("ADMIN_PASSWORD must be at least 12 characters");
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const existingAdmin = (
      await query("SELECT id FROM users WHERE email = $1", [adminEmail])
    ).rows[0] as { id: number } | undefined;
    let adminId: number;
    if (existingAdmin) {
      adminId = Number(existingAdmin.id);
      console.log("⏭️ Admin user already exists — skipping");
    } else {
      const admins = await query(
        "SELECT id FROM users WHERE role='admin' LIMIT 1",
      );
      if (admins.rowCount)
        throw new Error(
          "An admin already exists. Use db:rotate-admin for credential changes.",
        );
      const inserted = await query(
        "INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id",
        [adminEmail, passwordHash, "Raja Viveka Vardhan Siluveru", "admin"],
      );
      adminId = Number((inserted.rows[0] as { id: number }).id);
      console.log("✅ Admin user created");
    }

    // --- Research Themes ---
    const themes = [
      {
        title: "Biomedical Imaging & Digital Cytology",
        description:
          "Label-free autofluorescence microscopy, confocal AFI, multispectral imaging for non-invasive cancer screening at the single-cell level.",
        icon: "🔬",
        sort_order: 1,
      },
      {
        title: "AI for Medical Diagnosis",
        description:
          "Deep learning frameworks — denoising networks, synthetic augmentation, interpretable classifiers — for automated disease detection from imaging data.",
        icon: "🧠",
        sort_order: 2,
      },
      {
        title: "Signal & Image Processing",
        description:
          "Wavelet-domain methods, frequency-aware denoising, morphological feature extraction, and computational biosignal analysis.",
        icon: "📊",
        sort_order: 3,
      },
      {
        title: "Microgravity Simulation Systems",
        description:
          "IoT-enabled multi-modal clinostat/RPM platforms for space biology, cellular mechanotransduction, and microfluidic research.",
        icon: "🛰️",
        sort_order: 4,
      },
      {
        title: "Medical Instrumentation & Prototyping",
        description:
          "Hardware development — portable LED autofluorescence microscopes, ROS 2 sensor-fusion systems, and embedded edge-AI devices.",
        icon: "⚙️",
        sort_order: 5,
      },
      {
        title: "Robotics & Embedded Systems",
        description:
          "ROS 2 packages, Raspberry Pi–based instruments, stepper-motor control, IoT device management, and real-time sensor integration.",
        icon: "🤖",
        sort_order: 6,
      },
    ];
    for (const t of themes) {
      await query(
        "INSERT INTO research_themes (title, description, icon, sort_order) SELECT $1, $2, $3, $4 WHERE NOT EXISTS (SELECT 1 FROM research_themes WHERE title = $1)",
        [t.title, t.description, t.icon, t.sort_order],
      );
    }
    console.log("✅ Research themes created");

    // --- Research Projects ---
    const projects = [
      {
        title:
          "Non-Invasive AI Framework for Oral Cancer Detection via Autofluorescence Imaging",
        slug: "oral-cancer-afi",
        research_problem:
          "Oral cancer accounts for approximately 1.9% of annual cancer-related deaths worldwide, with a 5-year survival rate of only 50–55%. Diagnosis relies on invasive biopsy, which is time-consuming, requires tissue staining, and is subject to inter-observer variability. There is a critical need for a non-invasive, rapid, and accurate screening method.",
        motivation:
          "Label-free autofluorescence imaging (AFI) of exfoliated buccal cells captures metabolic and morphological changes associated with malignant transformation — before obvious morphological abnormalities appear. However, clinical adoption is limited by low signal-to-noise ratio, photon-dependent noise, small and imbalanced datasets, and the lack of robust AI models.",
        approach:
          "A unified, quality-controlled AFI research pipeline integrating: (1) multispectral confocal acquisition at 405/488/638 nm, (2) FASCANet frequency-aware denoising, (3) class-conditional StyleGAN2-ADA synthetic augmentation with texture-preserving loss, (4) automated quality-control screening, (5) AFiS-Net dual-branch classifier with cross-attention fusion, and (6) independent risk screening on unseen cohorts.",
        methodology:
          "Exfoliated buccal cells from non-smoker, susceptible (tobacco smokers), and histologically confirmed oral cancer cohorts were imaged without exogenous labels using a Leica STELLARIS 5 laser scanning confocal microscope. Images were acquired at 405, 488, and 638 nm excitation, registered as pseudo-RGB composites, and cropped to 256×256 single-cell regions of interest.",
        experimental_setup:
          "Leica STELLARIS 5 laser scanning confocal microscope with LAS X software. Three-channel acquisition: blue (410–480 nm), green (490–600 nm), red (650–750 nm). All acquisition parameters kept constant to avoid signal saturation.",
        hardware:
          "Leica STELLARIS 5 confocal microscope, glass slides, phosphate-buffered saline, centrifuge for cell pelleting.",
        data_acquisition:
          "Three spectral channels (405/488/638 nm excitation) → 1024×1024 fields → spatial co-registration → pseudo-RGB composites → 256×256 single-cell ROI crops → Otsu-based foreground extraction.",
        computational_method:
          "FASCANet: db2 wavelet decomposition → dual residual frequency branches → bidirectional Spatial Cross-Attention (SCA) → inverse wavelet reconstruction. AFiS-Net: ConvNeXt V2 + SwinV2 Transformer dual-branch with cross-attention fusion and generalized mean pooling.",
        results:
          "Denoising: PSNR 38.79 ± 2.30 dB, SSIM 0.90 ± 0.04 under mixed Poisson-Gaussian noise. Synthetic augmentation: KID reduced 20.45–25.74%, FID reduced 8.70–9.60%. Classification: macro F1 = 0.879 ± 0.035, AUC = 0.948 ± 0.029, MCC = 0.769 ± 0.064 under ROI-grouped 5-fold cross-validation. Cancer precision improved from 0.86 to 0.96; specificity from 0.94 to 0.98 after denoising.",
        key_contribution:
          "A complete quality-controlled AFI research pipeline — from acquisition through denoising, synthetic augmentation, group-aware classification, and independent risk screening — demonstrating that label-free autofluorescence cytology can support non-invasive oral cancer triage. Grad-CAM++ localised predictions to nuclear/perinuclear regions. Independent screening showed ordered normal→smoker→cancer probability continuum (Spearman ρ = 0.857).",
        status: "under_review",
        featured: 1,
        sort_order: 1,
        cover_image: "/research/oral-cancer/fig6_workflow_overview.png",
      },
      {
        title:
          "FASCANet: Frequency-Aware Spatial Cross-Attention Denoising for Label-Free Oral Cancer Screening",
        slug: "fascanet-denoising",
        research_problem:
          "Autofluorescence imaging of oral epithelial cells suffers from extremely low SNR due to weak intrinsic fluorophore emission combined with photon shot noise and detector read noise. Existing denoising methods either over-smooth metabolite-specific textures or require clean reference images that are impractical to acquire in clinical AFI.",
        motivation:
          "No existing noise-supervised denoising method addresses the joint requirements of Poisson-Gaussian noise suppression and metabolic-texture preservation in label-free autofluorescence data. Context-based self-supervised methods promote local smoothness, which destroys the fine spectral contrast carrying diagnostic information.",
        approach:
          "FASCANet operates in the wavelet domain, where autofluorescence noise and metabolic signal occupy distinct frequency bands. A single-level db2 wavelet decomposition separates the input into low-frequency approximation and high-frequency detail subbands, which are processed by two parallel residual branches coupled by a Spatial Cross-Attention module.",
        methodology:
          "Trained under a Noisier2Noise protocol without any clean reference images. Input images are decomposed by a single-level 2D Daubechies-2 (db2) discrete wavelet transform. Low-frequency and high-frequency subbands are processed by parallel residual branches with bidirectional spatial cross-attention after every pair of residual blocks.",
        experimental_setup:
          "Evaluated under Gaussian, Poisson, and mixed Poisson-Gaussian noise conditions across three independent random seeds. Tested against BM3D, Noise2Void, Noise2Same, Self2Self, Neighbor2Neighbor, Deep Image Prior, and a SwinConv hybrid baseline.",
        hardware:
          "Computational — GPU-based training pipeline. No hardware-specific requirements beyond standard deep learning infrastructure.",
        data_acquisition:
          "Same confocal AFI dataset as the integrated framework. Mixed Poisson-Gaussian noise added at controlled levels for denoising evaluation.",
        computational_method:
          "db2 wavelet decomposition → dual residual frequency branches (96 channels each, 6 residual blocks) → Spatial Cross-Attention (SCA) module with additive residual gating + Group Normalization → fusion block → 1×1 tail convolution → 12 residual channels → inverse db2 transform.",
        results:
          "PSNR 38.79 ± 2.30 dB, SSIM 0.90 ± 0.04. Outperformed BM3D, Noise2Void, Noise2Same, Self2Self, Neighbor2Neighbor, DIP, and SwinConv hybrid on PSNR, SSIM, VIF, FSIM, and MS-SSIM. Downstream cancer precision: 0.86 → 0.96, specificity: 0.94 → 0.98. Preserved optical NADH/FAD redox-ratio ordering.",
        key_contribution:
          "First noise-supervised wavelet-domain denoising network specifically designed for label-free autofluorescence imaging. Trained without clean references via Noisier2Noise. Spatial Cross-Attention enables bidirectional frequency-band information exchange. Preserves metabolically relevant fluorophore intensity relationships while removing diagnostic noise.",
        status: "under_review",
        featured: 1,
        sort_order: 2,
        cover_image: "/research/oral-cancer/model.png",
      },
      {
        title:
          "Automated Multi-Modal Microgravity-on-a-Chip Simulation Platform",
        slug: "microgravity-platform",
        research_problem:
          "Microgravity research on Earth requires reliable simulation of reduced-gravity environments. Existing clinostats and Random Positioning Machines (RPMs) operate in single modes, lack wireless control, and cannot accommodate modern microfluidic and Lab-on-Chip (LoC) formats. There is no unified platform combining multiple gravity simulation modes with planetary gravity profiles and remote operation.",
        motivation:
          'Space biology, cellular mechanotransduction, pharmaceutical research, and tissue engineering require reproducible, remotely operable microgravity simulation. Current instruments are mode-limited, not IoT-enabled, and cannot support the "Microgravity-on-Chip" paradigm for high-throughput, low-volume parallel experiments.',
        approach:
          "An IoT-enabled, wirelessly controlled dual-axis gimbal clinostat/RPM platform with a novel Hybrid Clinostat–RPM mode. Automated planetary gravity profile algorithms simulate Earth (1 g), Moon (0.166 g), Mars (0.376 g), and Space microgravity (~0 g). Universal Sample Holding Module (USHM) accommodates T25 flasks, well plates, microfluidic devices, and LoC carriers.",
        methodology:
          "Dual NEMA 14 stepper motors with TMC2209 UART drivers provide low-noise, high-precision dual-axis rotation. Raspberry Pi 3 central computing unit with Wi-Fi mobile-app GUI and live camera telemetry. A unified mathematical framework continuously computes and displays the time-averaged residual gravitational vector.",
        experimental_setup:
          "Dual-axis gimbal mechanics with NEMA 14 stepper motors and TMC2209 silent step drivers. Raspberry Pi 3 controller with integrated camera module. Mobile application for wireless parameter configuration and real-time monitoring.",
        hardware:
          "Dual NEMA 14 stepper motors, TMC2209 UART silent stepper drivers, Raspberry Pi 3, Raspberry Pi Camera Module, Wi-Fi module, Universal Sample Holding Module (T25 flasks, well plates, microfluidic devices, LoC carriers).",
        data_acquisition:
          "Real-time live video monitoring via integrated Raspberry Pi Camera Module. Continuous Gavg computation and display across all operational modes.",
        computational_method:
          "Embedded mathematical framework for real-time computation of time-averaged residual gravitational acceleration across 2D clinostat, 3D clinostat, RPM, and Hybrid Clinostat–RPM modes.",
        results:
          "PIC novelty search report obtained. Four operational modes: 2D clinostat, 3D clinostat, RPM, and Hybrid Clinostat–RPM. Planetary gravity profiles for Earth, Moon, Mars, and Space. USHM accommodates standard cell culture formats. Wireless remote control via mobile app with live camera feed.",
        key_contribution:
          'Novel Hybrid Clinostat–RPM mode. "Microgravity-on-Chip" concept miniaturizing experiments to chip scale. IoT-enabled wireless control with live video telemetry. Unified real-time gravitational vector computation. Universal Sample Holding Module for diverse experimental formats.',
        status: "filed",
        featured: 1,
        sort_order: 3,
        cover_image:
          "/research/microgravity/WhatsApp Image 2026-05-15 at 10.04.52.jpeg",
      },
      {
        title:
          "Label-Free Autofluorescence Microscope & Cell-Segmentation Pipeline (OncoSpectrix)",
        slug: "oncospectrix-microscope",
        research_problem:
          "Conventional oral cancer screening requires invasive biopsy and histopathological staining. 60–80% of oral cancers in India are diagnosed at Stage III/IV. There is a critical need for a portable, low-cost, label-free imaging system that can perform cell-level analysis at the point of care without requiring expensive laboratory infrastructure. The system must handle image acquisition, cell segmentation, denoising, feature extraction, and preliminary screening on edge without cloud connectivity.",
        motivation:
          "Translating the AFI-based screening pipeline from a benchtop Leica STELLARIS 5 confocal microscope to a portable, affordable LED-based device for clinical deployment. The system must be deployable in resource-limited settings where conventional biopsy-based methods are impractical.",
        approach:
          "A portable LED autofluorescence microscope built on a Raspberry Pi 5 with an integrated software pipeline for: (1) LED-based autofluorescence image acquisition at 405/488/638 nm wavelengths, (2) brightfield oral-cell segmentation using watershed methods, (3) FASCANet deep-learning denoising on edge, (4) CAFNet-Hybrid classification with cancer probability scoring, and (5) real-time risk assessment. LED excitation wavelengths map to specific cellular metabolites: 405 nm for NAD(P)H emission (440-460 nm), 465 nm for FAD/flavins (510-540 nm), 520 nm for Lipofuscin-like fluorophores (600-700 nm). This captures the metabolic signatures associated with malignant transformation. The complete pipeline (acquisition, segmentation, denoising, classification, risk scoring) runs entirely on the Raspberry Pi 5, eliminating cloud dependency.",
        methodology:
          "Sample collection: Exfoliated buccal cells collected using cotton swab, mixed in PBS inoculum, centrifuged, and prepared as smear on slides. Three study groups: normal (non-smokers), smoker (>4 cigarettes/day for >5 years), and histologically confirmed cancer. Image acquisition: LED excitation at 405 nm (blue), 488 nm (green), and 638 nm (red) channels. Images captured and registered as pseudo-RGB composites. Single-cell ROIs extracted at 256x256 resolution. Software pipeline: (1) Autofluorescence image acquisition with multi-channel LED control. (2) Brightfield imaging for cell segmentation reference. (3) Watershed-based cell segmentation. (4) FASCANet denoising inference on edge. (5) CAFNet-Hybrid classification with cancer probability scoring. (6) Real-time risk assessment and display. LED excitation sources replace laser-based confocal illumination for cost reduction. Raspberry Pi 5 provides sufficient compute for real-time segmentation and FASCANet/CAFNet inference.",
        experimental_setup:
          "Custom-built portable LED autofluorescence microscope on Raspberry Pi 5 platform. Integrated acquisition and analysis pipeline running entirely on edge. Custom-built software interface with multi-channel acquisition control, live ROI capture, brightfield segmentation, on-edge denoising, and rapid screening modes.",
        hardware:
          "Raspberry Pi 5, LED excitation sources (405/488/638 nm), camera module, custom microscope optics enclosure. Illumination circuit with programmable LED drivers for multi-wavelength excitation.",
        data_acquisition:
          "Three-channel LED-based autofluorescence excitation: blue (405 nm), green (488 nm), red (638 nm). Brightfield reference for cell segmentation. Live ROI capture for real-time single-cell extraction. Common ROI selection across all spectral channels.",
        computational_method:
          "Watershed-based cell segmentation from brightfield reference images. FASCANet denoising — db2 wavelet decomposition with Spatial Cross-Attention — running on edge without cloud connectivity. CAFNet-Hybrid classification: ConvNeXt V2-Nano (local texture) + SwinV2-Tiny (global context) with cross-attention fusion. Real-time cancer probability scoring and risk assessment.",
        results:
          "Functional prototype demonstrating label-free autofluorescence imaging at three excitation wavelengths, automated watershed-based cell segmentation, on-edge FASCANet denoising with PSNR 37.15 dB and SSIM 0.84, CAFNet-Hybrid classification with macro F1 = 0.879 and AUC = 0.948, cancer precision improved from 0.86 to 0.96 and specificity from 0.94 to 0.98, ordered normal-smoker-cancer probability continuum, complete pipeline running locally on Raspberry Pi 5, portable form factor suitable for point-of-care deployment.",
        key_contribution:
          "Translation of benchtop confocal AFI pipeline to a portable, affordable LED-based device. On-edge computation eliminates cloud dependency. Integrated acquisition → segmentation → denoising → classification → risk scoring pipeline. Foundation for OncoSpectrix commercial platform with IEC clinical approvals. Demonstrates that the complete AI diagnostic pipeline can run locally on a Raspberry Pi 5 for clinical screening in resource-limited settings.",
        status: "ongoing",
        featured: 1,
        sort_order: 4,
        cover_image: "/research/microscope/20260702_11h59m25s_grim.png",
      },
      {
        title:
          "Coal Volume Estimation System — ROS 2 Camera-LiDAR Sensor-Fusion Package",
        slug: "coal-volume-estimation",
        research_problem:
          "Accurate real-time measurement of bulk material volume and mass flow rate on industrial conveyor belts is critical for process control and inventory management. Existing systems rely on manual measurement or expensive commercial solutions.",
        motivation:
          "Develop an open-source, ROS 2–based sensor-fusion package that combines computer vision (PiCamera2 + YOLO segmentation) with 2D LiDAR depth profiling for real-time volumetric and mass flow-rate measurement on industrial conveyors.",
        approach:
          "An 8-node ROS 2 (Jazzy) package fusing PiCamera2/YOLO-segmented coal-mask occupancy with a downward RPLIDAR 2D depth profile. Deployed on Raspberry Pi 4 for real-time processing.",
        methodology:
          "PiCamera2 captures conveyor images; YOLO segmentation generates coal-mask occupancy maps; RPLIDAR provides 2D depth profiles; sensor fusion computes cross-sectional area, volume flow rate, mass flow rate, and cumulative measurements.",
        experimental_setup:
          "Raspberry Pi 4 with PiCamera2, RPLIDAR 2D LiDAR sensor mounted above industrial conveyor. ROS 2 Jazzy with 8 processing nodes.",
        hardware:
          "Raspberry Pi 4, PiCamera2, RPLIDAR 2D LiDAR, industrial conveyor system.",
        data_acquisition:
          "Real-time camera frames at conveyor belt speed. 2D LiDAR depth profiles at high update rate. YOLO segmentation for coal region detection.",
        computational_method:
          "8-node ROS 2 pipeline: camera acquisition → YOLO segmentation → coal mask generation → LiDAR depth profiling → sensor fusion → volumetric computation → mass flow estimation → data logging.",
        results:
          "Real-time measurement of cross-sectional area (0.011–0.012 m²), volume flow rate (~0.017 m³/s), mass flow rate (~14.8 kg/s, ~53 tonnes/hour), belt speed (1.5 m/s), density estimation (850 kg/m³). Confidence metric computed per scan.",
        key_contribution:
          "Open-source ROS 2 sensor-fusion package for industrial bulk material measurement. Real-time volumetric and mass flow-rate computation on edge. YOLO-based segmentation for non-uniform material profiles.",
        status: "completed",
        featured: 0,
        sort_order: 5,
        cover_image: "/research/coal-volume/scan_map.png",
      },
      {
        title:
          "Cannabis-Consumption Detection via ECG Morphological Features and Machine Learning",
        slug: "ecg-cannabis-detection",
        research_problem:
          "Detecting cannabis consumption through non-invasive physiological measurements. Current methods rely on blood/urine tests, which are invasive, time-consuming, and have limited detection windows. An ECG-based approach could provide rapid, non-invasive screening.",
        motivation:
          "Cannabis use affects cardiac electrophysiology through alterations in autonomic nervous system regulation. Morphological features in ECG signals — RR interval, QRS duration/amplitude, P-wave and T-wave parameters — may carry discriminative information for identifying cannabis consumers.",
        approach:
          "A complete MATLAB ECG processing pipeline with bandpass/notch filtering, db4 wavelet baseline-wander removal, Pan-Tompkins QRS detection, and morphological feature extraction. Nine ML classifiers benchmarked on a 200-subject cohort.",
        methodology:
          "200 subjects (100 normal, 100 cannabis-consuming). ECG processed through: bandpass filter → notch filter → db4 wavelet baseline removal → Pan-Tompkins delineation → morphological feature extraction (RR interval, QRS duration/amplitude, P-wave duration/amplitude, T-wave duration/amplitude).",
        experimental_setup:
          "Clinical ECG recordings from 200 subjects. MATLAB-based processing pipeline. Statistical validation via Mann-Whitney U testing.",
        hardware:
          "Clinical ECG acquisition system. MATLAB processing environment.",
        data_acquisition:
          "200-subject ECG dataset (100 normal, 100 cannabis-consuming). Standard lead ECG recordings.",
        computational_method:
          "Bandpass/notch filtering → db4 wavelet baseline removal → Pan-Tompkins QRS detection → morphological feature extraction → 9 ML classifiers (Gradient Boosting, XGBoost, Random Forest, SVM, KNN, Naive Bayes, Logistic Regression, Decision Tree, RNN-LSTM).",
        results:
          "Gradient Boosting achieved best accuracy: 92%, AUC 0.98. XGBoost and Random Forest: 90% each. RNN(LSTM): 87%. Mann-Whitney U testing: p < 0.001 for R-wave amplitude, RR interval, QRS duration, P-wave and T-wave amplitude. 6-fold cross-validation: 89% accuracy.",
        key_contribution:
          "First ML-based ECG morphological approach for cannabis consumption detection. Statistically validated group separation. Benchmarking of 9 classifiers with Gradient Boosting as top performer. Demonstrated feasibility of non-invasive cannabis screening via cardiac electrophysiology.",
        status: "completed",
        featured: 0,
        sort_order: 6,
        cover_image: "/research/ecg-cannabis-detection/corer.png",
      },
    ];

    for (const p of projects) {
      await query(
        `INSERT INTO projects (title, slug, research_problem, motivation, approach, methodology, experimental_setup, hardware, data_acquisition, computational_method, results, key_contribution, status, featured, sort_order, cover_image) SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16 WHERE NOT EXISTS (SELECT 1 FROM projects WHERE slug = $2)`,
        [
          p.title,
          p.slug,
          p.research_problem,
          p.motivation,
          p.approach,
          p.methodology,
          p.experimental_setup,
          p.hardware,
          p.data_acquisition,
          p.computational_method,
          p.results,
          p.key_contribution,
          p.status,
          p.featured,
          p.sort_order,
          p.cover_image,
        ],
      );
    }
    console.log("✅ Research projects created");

    // --- Publications ---
    const pubs = [
      {
        title:
          "Synthetic Augmentation for Label-free Digital Cytology of Oral Cancer Screening",
        authors: "S. R. V. Vardhan, Sk Sher Md, M. Pal, A. Barui",
        journal: "Computers in Biology and Medicine (Elsevier)",
        year: 2026,
        status: "under_review",
        abstract:
          "Designed a class-conditional StyleGAN2-ADA generator with a novel texture-preserving loss for autofluorescence cytology synthesis, cutting KID by 20.45–25.74% and FID by 8.70–9.60% without loss of diversity. Built an automated quality-control pipeline (DINOv2/CLIP similarity, LPIPS, class-margin and memorisation filters) that screened 2,000 synthetic images down to 215 for training augmentation. Developed AFiS-Net, a ConvNeXt V2–SwinV2 Transformer dual-branch classifier with cross-attention fusion; achieved macro F1 = 0.879 ± 0.035 and AUC = 0.948 ± 0.029 under leakage-safe, ROI-grouped 5-fold cross-validation. Cancer precision improved from 0.86 to 0.96 and specificity from 0.94 to 0.98 after denoising and augmentation. Independent screening on an unseen cohort demonstrated an ordered normal→smoker→cancer probability continuum (Spearman ρ = 0.857), confirming that the feature-space progression is biologically meaningful and not a smoker diagnosis.  Problem addressed: Label-free autofluorescence imaging (AFI) of exfoliated buccal cells provides non-invasive metabolic and morphological contrast for oral cancer screening, but its diagnostic value is limited by photon-dependent noise, small and imbalanced datasets, and the lack of robust AI models trained with rigorous group-aware validation.  Methodology: Exfoliated buccal cells from non-smoker, susceptible (tobacco smokers), and histologically confirmed oral cancer cohorts were imaged at 405/488/638 nm using a Leica STELLARIS 5 confocal microscope. A unified quality-controlled AFI pipeline was developed: (1) FASCANet frequency-aware denoising, (2) class-conditional StyleGAN2-ADA synthetic augmentation with texture-preserving loss, (3) automated quality-control screening of 2,000 generated candidates to 215 retained images, and (4) AFiS-Net dual-branch classification with cross-attention fusion.  Key contribution: A complete quality-controlled AFI research pipeline demonstrating that synthetic augmentation is most useful when generated images are rigorously screened and performance is evaluated with group-aware splits. The proposed system is intended as a triage framework, not a replacement for biopsy or histopathology.  Related project: Non-Invasive AI Framework for Oral Cancer Detection via Autofluorescence Imaging.",
        doi: null,
        research_area: "Biomedical Imaging, AI for Cancer Screening",
        sort_order: 1,
      },
      {
        title:
          "FASCANet: Frequency-Aware Spatial Cross-Attention Denoising for Label-Free Oral Cancer Screening from Autofluorescent Images",
        authors: "S. R. V. Vardhan, Sk Sher Md, M. Pal, A. Barui",
        journal:
          "IEEE Journal of Biomedical and Health Informatics (IEEE JBHI)",
        year: 2026,
        status: "under_review",
        abstract:
          "Designed FASCANet, a Noisier2Noise-trained, db2 wavelet-domain dual-branch residual network coupled by a Spatial Cross-Attention module, requiring no clean reference images. Achieved PSNR 38.79 ± 2.30 dB / SSIM 0.90 ± 0.04 under mixed Poisson-Gaussian noise, outperforming BM3D, Noise2Void, Noise2Same, Self2Self, Neighbor2Neighbor, DIP and a SwinConv hybrid baseline. Improved downstream 3-class classification: cancer precision 0.86 → 0.96 and specificity 0.94 → 0.98, while preserving the optical NADH/FAD redox-ratio ordering across groups.  Problem addressed: Autofluorescence imaging of oral epithelial cells suffers from extremely low SNR due to weak intrinsic fluorophore emission combined with photon shot noise and detector read noise. Existing denoising methods either over-smooth metabolite-specific textures or require clean reference images that are impractical to acquire in clinical AFI.  Methodology: FASCANet operates in the wavelet domain, where autofluorescence noise and metabolic signal occupy distinct frequency bands. A single-level db2 wavelet decomposition separates the input into low-frequency approximation and high-frequency detail subbands, which are processed by two parallel residual branches coupled by a Spatial Cross-Attention module. Trained under a Noisier2Noise protocol without any clean reference images. Evaluated under Gaussian, Poisson, and mixed Poisson-Gaussian noise conditions across three independent random seeds.  Key contribution: First noise-supervised wavelet-domain denoising network specifically designed for label-free autofluorescence imaging. Spatial Cross-Attention enables bidirectional frequency-band information exchange. Preserves metabolically relevant fluorophore intensity relationships while removing diagnostic noise.  Related project: FASCANet Denoising Network.",
        research_area: "Biomedical Imaging, Denoising, Deep Learning",
        sort_order: 2,
      },
    ];

    for (const p of pubs) {
      await query(
        "INSERT INTO publications (title, authors, journal, year, status, abstract, research_area, doi, sort_order) SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9 WHERE NOT EXISTS (SELECT 1 FROM publications WHERE title = $1)",
        [
          p.title,
          p.authors,
          p.journal,
          p.year,
          p.status,
          p.abstract,
          p.research_area,
          p.doi || null,
          p.sort_order,
        ],
      );
    }
    console.log("✅ Publications created");

    // --- Patents ---
    const patents = [
      {
        title:
          "Automated Multi-Modal Microgravity-on-a-Chip Simulation Platform",
        inventors: "A. Sarkar, S. R. V. Vardhan, Dr. A. Barui",
        applicant:
          "Indian Institute of Engineering Science and Technology (IIEST), Shibpur",
        status: "search_report",
        description:
          "IoT-enabled dual-axis clinostat/RPM platform with a novel Hybrid mode for controlled microgravity simulation across planetary gravity profiles.",
        innovation:
          "Hybrid Clinostat–RPM mode, Microgravity-on-Chip concept, IoT wireless control with real-time telemetry, and universal sample holding module for diverse experimental formats.",
        research_area:
          "Microgravity Simulation, Space Biology, IoT Instrumentation",
        sort_order: 1,
      },
      {
        title:
          "Label-free Autofluorescence Imaging Device & AI-based Screening Method for Oral Cancer",
        inventors: "S. R. V. Vardhan, Sk Sher Md, M. Pal, A. Barui",
        applicant:
          "IIEST Shibpur, with AI4ICPS I-Hub Foundation (IIT Kharagpur) as co-IP party",
        status: "search_report",
        description:
          "Portable LED-based autofluorescence microscope with embedded on-edge AI pipeline for non-invasive, label-free oral cancer screening at point of care.",
        innovation:
          "Integrated AFI hardware with on-edge AI inference running the full denoising to classification pipeline locally on Raspberry Pi 5, eliminating cloud dependency.",
        research_area: "Biomedical Imaging, Medical Device, AI Diagnostics",
        sort_order: 2,
      },
    ];

    for (const p of patents) {
      await query(
        "INSERT INTO patents (title, inventors, applicant, status, description, innovation, research_area, sort_order) SELECT $1, $2, $3, $4, $5, $6, $7, $8 WHERE NOT EXISTS (SELECT 1 FROM patents WHERE title = $1)",
        [
          p.title,
          p.inventors,
          p.applicant,
          p.status,
          p.description,
          p.innovation,
          p.research_area,
          p.sort_order,
        ],
      );
    }
    console.log("✅ Patents created");

    // --- Theses ---
    const theses = [
      {
        title:
          "A Non-Invasive AI-Based Framework for Early Oral Cancer Detection Using Autofluorescence Imaging",
        degree: "Master of Technology (M.Tech)",
        institution:
          "Centre for Healthcare Science and Technology, Indian Institute of Engineering Science and Technology (IIEST), Shibpur",
        supervisor: "Dr. Ananya Barui",
        year: "2024–2026",
        research_problem:
          "Early detection of oral cancer remains difficult because definitive diagnosis requires an invasive biopsy, and robust AI models require well-curated imaging data. Oral cancer accounts for approximately 1.9% of annual cancer-related deaths worldwide, with a 5-year survival rate of only 50–55%. 60–80% of oral cancers in India are diagnosed at Stage III/IV. Label-free autofluorescence imaging (AFI) of exfoliated buccal cells provides non-invasive metabolic and morphological contrast, but its diagnostic value is limited by photon-dependent noise, small and imbalanced datasets, and the lack of robust AI models trained with rigorous group-aware validation.",
        objective:
          "To develop a unified, quality-controlled AFI research pipeline integrating frequency-aware denoising, class-conditional synthetic augmentation, automated synthetic-image selection, leakage-aware classification, and independent risk screening for non-invasive oral cancer detection. The system translates from benchtop confocal microscopy to a portable LED-based microscope for clinical deployment.",
        methodology:
          "Exfoliated buccal cells from non-smoker (normal), susceptible (tobacco smokers >4 cigarettes/day for >5 years), and histologically confirmed oral cancer cohorts were imaged without exogenous labels using a Leica STELLARIS 5 laser scanning confocal microscope at 405/488/638 nm excitation, registered as pseudo-RGB composites, and cropped to 256×256 single-cell ROIs.  Pipeline stages: (1) FASCANet frequency-aware denoising — db2 wavelet decomposition, dual residual frequency branches, Spatial Cross-Attention, inverse wavelet reconstruction — trained under Noisier2Noise protocol without clean references. (2) Class-conditional StyleGAN2-ADA synthetic augmentation with Neural Texture Preserving (NTP) loss — reducing FID by 8.70–9.60% and KID by 20.45–25.74%. (3) Automated quality-control pipeline screening 2,000 generated candidates down to 215 retained images using DINOv2/CLIP similarity, LPIPS, class-margin, and memorisation filters. (4) CAFNet-Hybrid dual-branch classifier — ConvNeXt V2-Nano for local texture + SwinV2-Tiny for global context, fused via cross-attention. (5) ROI-grouped 5-fold cross-validation with independent Stage 3 screening cohort.  Hardware: Custom-built portable LED autofluorescence microscope on Raspberry Pi 5 with 405/488/638 nm LED excitation, integrated cell-segmentation and on-edge screening pipeline (OncoSpectrix platform).",
        key_contributions:
          "1. FASCANet: First noise-supervised wavelet-domain denoising network for label-free AFI. db2 decomposition with Spatial Cross-Attention enabling bidirectional frequency-band information exchange. PSNR 38.79 ± 2.30 dB, SSIM 0.90 ± 0.04 without clean references.  2. Texture-preserving StyleGAN2-ADA with Neural Texture Preservation (NTP) loss and automated quality-control pipeline. 2,000 generated → 215 retained. KID reduced 20.45–25.74%, FID reduced 8.70–9.60% while maintaining diversity.  3. CAFNet-Hybrid: ConvNeXt V2-Nano + SwinV2-Tiny dual-branch classifier with Feature Pyramid Network, Generalized Mean pooling, and cross-attention fusion. Macro F1 = 0.879 ± 0.035, AUC = 0.948 ± 0.029, MCC = 0.769 ± 0.064 under ROI-grouped 5-fold cross-validation.  4. Independent screening on unseen cohort demonstrating ordered normal→smoker→cancer probability continuum (Spearman ρ = 0.857, p < 10⁻¹²), with smokers showing greatest out-of-distribution novelty — evidence of a feature-space continuum, not a smoker diagnosis.  5. OncoSpectrix: Translation of benchtop confocal pipeline to portable LED-based microscope on Raspberry Pi 5 with on-edge AI inference.  6. Grad-CAM++ interpretability localising model evidence to nuclear and perinuclear regions.",
        results:
          "Denoising: PSNR 38.79 ± 2.30 dB, SSIM 0.90 ± 0.04 under mixed Poisson-Gaussian noise. Downstream 3-class EfficientNet-B0: cancer precision 0.86 → 0.96, specificity 0.94 → 0.98 after denoising.  Synthetic augmentation: StyleGAN2-ADA + NTP loss achieved FID 73.51 (vs 80.52 baseline) for cancer, KID 0.0297 (vs 0.0374) for cancer. Quality pipeline retained 215 of 2,000 candidates.  Classification (ROI-grouped 5-fold): CAFNet-Hybrid macro F1 = 0.879 ± 0.035, AUC = 0.948 ± 0.029, cancer precision 0.96, specificity 0.98. Cancer sensitivity 0.862.  Independent screening: Ordered normal→smoker→cancer probability trend confirmed (Spearman ρ = 0.857). Smoker images showed greatest OOD novelty, consistent with intermediate AFI phenotype.  Dataset: 608 development images (348 normal, 260 cancer) + 43 independent screening images (14 normal, 18 smoker, 11 cancer).",
        conclusions:
          "Synthetic augmentation is most useful when generated images are rigorously screened and performance is evaluated with group-aware splits. The proposed system is intended as a triage framework, not a replacement for biopsy or histopathology. The independent screening result describes an ordered feature-space continuum and not a smoker diagnosis.",
        future_work:
          "Prospective, patient-level, multisite clinical validation. Extension to additional cancer types and imaging modalities. NVIDIA Jetson AGX Orin for on-edge model training. Collection of larger datasets from different study groups through the developed microscope. Conversion of lab prototype to market-ready product with IEC clinical approvals.",
        sort_order: 1,
      },
      {
        title:
          "Differentiating Cannabis-Consuming Population from Non-Consumers using ECG Morphological Features through Machine Learning Models",
        degree: "Bachelor of Technology (B.Tech)",
        institution:
          "Department of Biotechnology & Medical Engineering, National Institute of Technology (NIT), Rourkela",
        supervisor: "Dr. J. Sivaraman",
        year: "2023–2024",
        research_problem:
          "Non-invasive detection of cannabis consumption through cardiac electrophysiology. Current methods rely on invasive blood/urine tests with limited detection windows. Cannabis use affects cardiac electrophysiology through alterations in autonomic nervous system regulation, and morphological features in ECG signals may carry discriminative information for identifying cannabis consumers.",
        objective:
          "To develop and benchmark machine learning classifiers for differentiating cannabis consumers from non-consumers using ECG morphological features extracted from standard ECG recordings. To identify statistically validated biomarkers for non-invasive cannabis screening.",
        methodology:
          "200-subject cohort (100 normal, 100 cannabis-consuming). Complete MATLAB ECG processing pipeline: (1) Bandpass filtering for noise removal. (2) Notch filtering for powerline interference. (3) db4 wavelet baseline-wander removal. (4) Pan-Tompkins QRS detection and P/QRS/T wave delineation. (5) Morphological feature extraction: RR interval, QRS duration/amplitude, P-wave duration/amplitude, T-wave duration/amplitude. (6) Statistical validation via Mann-Whitney U testing. (7) Benchmarking of 9 ML classifiers: Gradient Boosting, XGBoost, Random Forest, SVM, KNN, Naive Bayes, Logistic Regression, Decision Tree, RNN-LSTM.",
        key_contributions:
          "1. First ML-based ECG morphological approach for cannabis consumption detection. 2. Statistically validated group separation with Mann-Whitney U testing (p < 0.001 for R-wave amplitude, RR interval, QRS duration, P-wave and T-wave amplitude). 3. Gradient Boosting identified as top performer (92% accuracy, AUC 0.98). 4. 6-fold cross-validation: 89% accuracy demonstrating generalisability. 5. Comprehensive benchmarking of 9 classifiers establishing a baseline for future work.",
        results:
          "Gradient Boosting: 92% accuracy, AUC 0.98 (best performer). XGBoost: 90% accuracy. Random Forest: 90% accuracy. RNN(LSTM): 87% accuracy. Mann-Whitney U testing: p < 0.001 for R-wave amplitude, RR interval, QRS duration, P-wave and T-wave amplitude — confirming statistically significant group separation. 6-fold cross-validation: 89% accuracy.",
        conclusions:
          "ECG morphological features carry discriminative information for cannabis consumption detection. Gradient Boosting provides the best classification performance, suggesting that tree-based ensemble methods are well-suited for this type of structured physiological feature space.",
        future_work:
          "Larger cohort validation with diverse populations. Real-time deployment for point-of-care screening. Longitudinal monitoring to track cannabis cessation effects on ECG morphology. Extension to other substance detection via cardiac electrophysiology.",
        pdf_url: null,
        sort_order: 2,
      },
    ];

    for (const t of theses) {
      await query(
        "INSERT INTO theses (title, degree, institution, supervisor, year, research_problem, objective, methodology, key_contributions, results, conclusions, future_work, pdf_url, sort_order) SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14 WHERE NOT EXISTS (SELECT 1 FROM theses WHERE title = $1)",
        [
          t.title,
          t.degree,
          t.institution,
          t.supervisor,
          t.year,
          t.research_problem,
          t.objective,
          t.methodology,
          t.key_contributions,
          t.results,
          t.conclusions,
          t.future_work,
          t.pdf_url,
          t.sort_order,
        ],
      );
    }
    console.log("✅ Theses created");

    // --- Timeline ---
    const timeline = [
      {
        title: "B.Tech Biomedical Engineering",
        description:
          "Started B.Tech at NIT Rourkela, Department of Biotechnology & Medical Engineering.",
        date: "2018",
        category: "education",
        icon: "🎓",
        sort_order: 1,
      },
      {
        title: "B.Tech Thesis: ECG Cannabis Detection",
        description:
          "Completed undergraduate research on differentiating cannabis consumers from non-consumers using ECG morphological features and ML classifiers. Supervisor: Dr. J. Sivaraman.",
        date: "2022",
        category: "research",
        icon: "📊",
        sort_order: 2,
      },
      {
        title: "B.Tech Graduation",
        description:
          "Graduated from NIT Rourkela with B.Tech in Biomedical Engineering, CGPA 8.55/10.0.",
        date: "2022",
        category: "education",
        icon: "🎓",
        sort_order: 3,
      },
      {
        title: "M.Tech Biomedical Engineering",
        description:
          "Joined IIEST Shibpur, Centre for Healthcare Science and Technology. Supervisor: Dr. Ananya Barui.",
        date: "2024",
        category: "education",
        icon: "🎓",
        sort_order: 4,
      },
      {
        title: "Microgravity Platform Development",
        description:
          "Designed and built the automated multi-modal microgravity-on-a-chip simulation platform with dual NEMA 14 stepper motors, Raspberry Pi 3 controller, and IoT mobile app.",
        date: "2025",
        category: "project",
        icon: "🛰️",
        sort_order: 5,
      },
      {
        title: "Patent Filed: Microgravity Platform",
        description:
          "Patent application filed at IIEST Shibpur. PIC novelty search report obtained. Inventors: A. Sarkar, S.R.V. Vardhan, Dr. A. Barui.",
        date: "2025",
        category: "patent",
        icon: "📄",
        sort_order: 6,
      },
      {
        title: "OncoSpectrix Hardware Prototype",
        description:
          "Built portable LED autofluorescence microscope on Raspberry Pi 5 with integrated cell-segmentation and on-edge screening pipeline.",
        date: "2025",
        category: "project",
        icon: "🔬",
        sort_order: 7,
      },
      {
        title: "FASCANet Denoising Network",
        description:
          "Designed frequency-aware spatial cross-attention denoising network for label-free AFI. Achieved PSNR 38.79 ± 2.30 dB without clean references.",
        date: "2025",
        category: "research",
        icon: "🧠",
        sort_order: 8,
      },
      {
        title: "StyleGAN2 Synthetic Augmentation",
        description:
          "Developed texture-preserving StyleGAN2-ADA with automated QC pipeline. 2,000 generated → 215 retained for augmentation.",
        date: "2025",
        category: "research",
        icon: "🎨",
        sort_order: 9,
      },
      {
        title: "AFiS-Net Classifier",
        description:
          "Built ConvNeXt V2 + SwinV2 dual-branch classifier. Macro F1 = 0.879, AUC = 0.948 under ROI-grouped 5-fold cross-validation.",
        date: "2026",
        category: "research",
        icon: "🧠",
        sort_order: 10,
      },
      {
        title: "FASCANet Manuscript Submitted to IEEE JBHI",
        description:
          "Manuscript submitted to IEEE Journal of Biomedical and Health Informatics. Under review.",
        date: "2026",
        category: "publication",
        icon: "📝",
        sort_order: 11,
      },
      {
        title: "Synthetic Augmentation Manuscript Submitted to CBM",
        description:
          "Manuscript submitted to Computers in Biology and Medicine (Elsevier). Under review.",
        date: "2026",
        category: "publication",
        icon: "📝",
        sort_order: 12,
      },
      {
        title: "Patent Filed: AFI Device & AI Screening",
        description:
          "Patent application for OncoSpectrix hardware + AI diagnostic platform, filed with IIEST Shibpur and AI4ICPS I-Hub Foundation (IIT Kharagpur).",
        date: "2026",
        category: "patent",
        icon: "📄",
        sort_order: 13,
      },
      {
        title: "OncoSpectrix MedTech Startup Incubated",
        description:
          "Startup incubated at TCGTBI, IIEST Shibpur. Integrating OncoSpectrix hardware, AI stack, IEC clinical approvals, and patent filing. Multiple BIRAC grant proposals authored.",
        date: "2026",
        category: "startup",
        icon: "🚀",
        sort_order: 14,
      },
      {
        title: "M.Tech Graduation — University Gold Medallist",
        description:
          "Graduated with M.Tech in Biomedical Engineering, CGPA 9.93/10. University Gold Medallist.",
        date: "2026",
        category: "award",
        icon: "🏆",
        sort_order: 15,
      },
    ];

    for (const t of timeline) {
      await query(
        "INSERT INTO timeline (title, description, date, category, icon, sort_order) SELECT $1, $2, $3, $4, $5, $6 WHERE NOT EXISTS (SELECT 1 FROM timeline WHERE title = $1)",
        [t.title, t.description, t.date, t.category, t.icon, t.sort_order],
      );
    }
    console.log("✅ Timeline created");

    // --- Research Notes (Blog) ---
    const admin = { id: adminId };

    const posts = [
      {
        title: "Understanding Autofluorescence Imaging for Cancer Screening",
        slug: "understanding-afi-cancer-screening",
        content:
          "<h2>What is Autofluorescence Imaging?</h2><p>Autofluorescence imaging (AFI) is a label-free optical technique that detects cellular abnormalities through the endogenous autofluorescence of cells, which reflects their metabolic status. Endogenous fluorophores such as NAD(P)H and FAD participate in cellular respiration and produce measurable intensity differences that distinguish healthy from malignant conditions.</p><h2>Why It Matters for Oral Cancer</h2><p>Oral cancer is often diagnosed at an advanced stage. AFI offers a non-invasive alternative to biopsy by capturing metabolic changes that occur before obvious morphological abnormalities appear. This makes it a promising screening tool for early detection.</p><h2>Our Approach</h2><p>We developed a complete pipeline from confocal acquisition through denoising, synthetic augmentation, and AI-based classification — all without exogenous labels or contrast agents.</p>",
        excerpt:
          "An introduction to label-free autofluorescence imaging and its potential for non-invasive oral cancer screening.",
        published: 1,
        category: "research_notes",
      },
      {
        title:
          "Frequency-Aware Denoising: Why Wavelets Matter for Medical Imaging",
        slug: "frequency-aware-denoising-wavelets",
        content:
          "<h2>The Problem</h2><p>Medical imaging data — especially in fluorescence microscopy — suffers from noise that occupies different frequency bands than the signal of interest. Traditional denoising methods treat all frequencies equally, often destroying the fine textures that carry diagnostic information.</p><h2>Wavelet Decomposition</h2><p>By decomposing images using a discrete wavelet transform (db2), we can separate low-frequency background from high-frequency detail and apply targeted corrections to each band independently.</p><h2>Spatial Cross-Attention</h2><p>The key innovation in FASCANet is coupling these frequency branches through a Spatial Cross-Attention module, enabling bidirectional information exchange without losing spectral specialization.</p>",
        excerpt:
          "How FASCANet uses db2 wavelet decomposition and spatial cross-attention to denoise autofluorescence images while preserving metabolic texture.",
        published: 1,
        category: "research_notes",
      },
      {
        title:
          "Building a Portable Autofluorescence Microscope on Raspberry Pi",
        slug: "portable-afi-microscope-rpi",
        content:
          "<h2>From Benchtop to Bedside</h2><p>Translating a confocal AFI pipeline from a Leica STELLARIS 5 to a portable LED-based microscope on Raspberry Pi 5 required rethinking every stage: illumination, detection, segmentation, and inference.</p><h2>Design Choices</h2><p>LED excitation at 405/488/638 nm replaces laser illumination. The Raspberry Pi 5 provides sufficient compute for watershed-based cell segmentation and on-edge deep-learning inference. The entire pipeline runs locally without cloud connectivity.</p><h2>Edge AI</h2><p>Denoising and preliminary screening run entirely on the Raspberry Pi, making the system deployable in resource-constrained clinical environments.</p>",
        excerpt:
          "Design decisions and engineering trade-offs in building a portable label-free autofluorescence microscope for point-of-care screening.",
        published: 1,
        category: "research_notes",
      },
    ];

    for (const p of posts) {
      await query(
        `INSERT INTO posts (title, slug, content, excerpt, published, author_id, category, published_at) SELECT $1, $2, $3, $4, $5, $6, $7, NOW() WHERE NOT EXISTS (SELECT 1 FROM posts WHERE slug = $2)`,
        [
          p.title,
          p.slug,
          p.content,
          p.excerpt,
          p.published,
          admin.id,
          p.category,
        ],
      );
    }
    console.log("✅ Research notes created");

    // --- Project Media ---
    // Get project IDs
    const oralCancerId = (
      (
        await query("SELECT id FROM projects WHERE slug = $1", [
          "oral-cancer-afi",
        ])
      ).rows[0] as { id: number } | undefined
    )?.id;
    const fascanetId = (
      (
        await query("SELECT id FROM projects WHERE slug = $1", [
          "fascanet-denoising",
        ])
      ).rows[0] as { id: number } | undefined
    )?.id;
    const microgravityId = (
      (
        await query("SELECT id FROM projects WHERE slug = $1", [
          "microgravity-platform",
        ])
      ).rows[0] as { id: number } | undefined
    )?.id;
    const microscopeId = (
      (
        await query("SELECT id FROM projects WHERE slug = $1", [
          "oncospectrix-microscope",
        ])
      ).rows[0] as { id: number } | undefined
    )?.id;
    const coalId = (
      (
        await query("SELECT id FROM projects WHERE slug = $1", [
          "coal-volume-estimation",
        ])
      ).rows[0] as { id: number } | undefined
    )?.id;
    const ecgId = (
      (
        await query("SELECT id FROM projects WHERE slug = $1", [
          "ecg-cannabis-detection",
        ])
      ).rows[0] as { id: number } | undefined
    )?.id;

    async function insertMedia(
      projectId: number | undefined,
      filePath: string,
      mediaType: string,
      caption: string,
      section: string,
      sortOrder: number,
    ) {
      if (!projectId) return;
      await query(
        "INSERT INTO project_media (project_id, file_path, media_type, caption, section, sort_order) SELECT $1, $2, $3, $4, $5, $6 WHERE NOT EXISTS (SELECT 1 FROM project_media WHERE project_id=$1 AND file_path=$2)",
        [projectId, filePath, mediaType, caption, section, sortOrder],
      );
    }

    // Oral Cancer AFI - pipeline figures
    await insertMedia(
      oralCancerId,
      "/research/oral-cancer/fig6_workflow_overview.png",
      "image",
      "Complete research pipeline: confocal AFI acquisition through denoising, synthetic augmentation, classification, and independent screening.",
      "methodology",
      1,
    );
    await insertMedia(
      oralCancerId,
      "/research/oral-cancer/model.png",
      "image",
      "FASCANet denoising architecture with wavelet and residual branches.",
      "computational_method",
      2,
    );
    await insertMedia(
      oralCancerId,
      "/research/oral-cancer/fig5b_screening_progression.png",
      "image",
      "Ordered normal → smoker → cancer probability continuum from independent risk screening (Spearman ρ = 0.857).",
      "results",
      3,
    );
    await insertMedia(
      oralCancerId,
      "/research/oral-cancer/noiseanalysis.png",
      "image",
      "Noise analysis across spectral channels under mixed Poisson-Gaussian conditions.",
      "experimental_setup",
      4,
    );
    await insertMedia(
      oralCancerId,
      "/research/oral-cancer/rawcolorrep.png",
      "image",
      "Raw and denoised spectral-channel images across the study groups.",
      "results",
      5,
    );
    await insertMedia(
      oralCancerId,
      "/research/oral-cancer/redoox.png",
      "image",
      "NADH/FAD redox-ratio analysis showing preserved metabolic ordering after denoising.",
      "results",
      6,
    );
    await insertMedia(
      oralCancerId,
      "/research/oral-cancer/greenimsgingsoft.png",
      "image",
      "Green-channel imaging software interface for AFI acquisition.",
      "experimental_setup",
      7,
    );
    await insertMedia(
      oralCancerId,
      "/research/oral-cancer/segmentingsoft.png",
      "image",
      "Cell segmentation software interface for single-cell ROI extraction.",
      "data_acquisition",
      8,
    );

    // FASCANet - denoising figures
    await insertMedia(
      fascanetId,
      "/research/oral-cancer/model.png",
      "image",
      "FASCANet denoising architecture with wavelet and residual branches.",
      "computational_method",
      1,
    );
    await insertMedia(
      fascanetId,
      "/research/oral-cancer/noiseanalysis.png",
      "image",
      "Noise characterization across AFI spectral channels.",
      "experimental_setup",
      2,
    );
    await insertMedia(
      fascanetId,
      "/research/oral-cancer/rawcolorrep.png",
      "image",
      "Raw and denoised spectral-channel images across the study groups.",
      "results",
      3,
    );
    await insertMedia(
      fascanetId,
      "/research/oral-cancer/redoox.png",
      "image",
      "Preserved NADH/FAD redox ratio after FASCANet denoising.",
      "results",
      4,
    );

    // Microgravity Platform
    await insertMedia(
      microgravityId,
      "/research/microgravity/WhatsApp Image 2026-05-15 at 10.04.52.jpeg",
      "image",
      "CAD rendering of the dual-axis microgravity simulation platform.",
      "hardware",
      1,
    );
    await insertMedia(
      microgravityId,
      "/research/microgravity/WhatsApp Video 2026-05-16 at 16.51.39.mp4",
      "video",
      "Platform operating in 3D clinostat mode with real-time Gavg computation.",
      "experimental_setup",
      2,
    );
    await insertMedia(
      microgravityId,
      "/research/microgravity/WhatsApp Video 2026-08-21 at 13.58.28.mp4",
      "video",
      "Hybrid Clinostat–RPM mode demonstration with IoT mobile app control.",
      "experimental_setup",
      3,
    );
    await insertMedia(
      microgravityId,
      "/research/microgravity/WhatsApp Video 2026-08-21 at 13.58.34.mp4",
      "video",
      "Live camera telemetry feed during microgravity simulation.",
      "experimental_setup",
      4,
    );

    // OncoSpectrix Microscope — Hardware
    await insertMedia(
      microscopeId,
      "/research/microscope/20260702_11h59m25s_grim.png",
      "image",
      "Brightfield acquisition software with a common region of interest.",
      "data_acquisition",
      1,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/20260702_12h02m03s_grim.png",
      "image",
      "Blue-channel image acquisition software interface.",
      "data_acquisition",
      2,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/20260702_12h53m03s_grim.png",
      "image",
      "Red-channel image acquisition software interface.",
      "data_acquisition",
      3,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/WhatsApp Image 2026-08-21 at 13.58.09.jpeg",
      "image",
      "Microscope prototype — full system view with LED illumination and optics enclosure.",
      "hardware",
      4,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/WhatsApp Image 2026-08-21 at 13.58.09 (1).jpeg",
      "image",
      "Microscope prototype — close-up of optical assembly and LED excitation module.",
      "hardware",
      5,
    );

    // OncoSpectrix Microscope — PPT content: LED excitation table
    await insertMedia(
      microscopeId,
      "/research/microscope/led-excitation-wavelengths.png",
      "image",
      "Examples of low contrast and noisy autofluorescence images, with sources of noise.",
      "research_problem",
      10,
    );

    // PPT: Literature review — oral cancer statistics
    await insertMedia(
      microscopeId,
      "/research/microscope/oral-cancer-statistics.png",
      "image",
      "Literature comparison of deep-learning methods for oral cancer classification.",
      "research_problem",
      11,
    );

    // PPT: Sample collection and imaging workflow
    await insertMedia(
      microscopeId,
      "/research/microscope/sample-collection-workflow.png",
      "image",
      "Literature comparison of generative methods used for autofluorescence imaging.",
      "methodology",
      12,
    );

    // PPT: AFI images of oral cells
    await insertMedia(
      microscopeId,
      "/research/microscope/afi-cell-images.png",
      "image",
      "Sample collection, preparation, and multispectral image acquisition workflow.",
      "experimental_setup",
      13,
    );

    // PPT: FASCANet architecture diagram
    await insertMedia(
      microscopeId,
      "/research/microscope/fascanet-architecture.png",
      "image",
      "Tables comparing denoising image quality and classification performance.",
      "results",
      14,
    );

    // PPT: Denoising comparison
    await insertMedia(
      microscopeId,
      "/research/microscope/denoising-results.png",
      "image",
      "Image quality comparison for synthetic augmentation methods.",
      "results",
      15,
    );

    // PPT: Denoising performance table
    await insertMedia(
      microscopeId,
      "/research/microscope/denoising-metrics-table.png",
      "image",
      "Classifier comparison table reporting macro F1, AUC, and cancer sensitivity.",
      "results",
      16,
    );

    // PPT: Redox ratio preservation
    await insertMedia(
      microscopeId,
      "/research/microscope/redox-ratio-preservation.png",
      "image",
      "Microscope prototype and component assembly montage.",
      "hardware",
      17,
    );

    // Existing screenshots — on-edge pipeline
    await insertMedia(
      microscopeId,
      "/research/microscope/edge-segmentation-brightfield.png",
      "image",
      "Multichannel autofluorescence images, regions of interest, and composite.",
      "data_acquisition",
      20,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/edge-fluorescence-analysis.png",
      "image",
      "Raw and synthetic fluorescence images for normal and cancer groups.",
      "results",
      21,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/WhatsApp Video 2026-08-21 at 13.58.22.mp4",
      "video",
      "OncoSpectrix prototype demonstration — complete acquisition and on-edge screening pipeline in operation.",
      "experimental_setup",
      22,
    );

    // Raspberry Pi edge processing images
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/blue capturing.png",
      "image",
      "Raspberry Pi software: Blue channel (405 nm) autofluorescence image capture interface showing LED excitation control and camera settings.",
      "data_acquisition",
      30,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/green capturing.png",
      "image",
      "Raspberry Pi software: Green channel (488 nm) autofluorescence image capture interface for multi-wavelength acquisition.",
      "data_acquisition",
      31,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/red ccacpturing.png",
      "image",
      "Raspberry Pi software: Red channel (638 nm) autofluorescence image capture interface completing the three-channel acquisition.",
      "data_acquisition",
      32,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/ommon ROI capturing for all colors .png",
      "image",
      "Raspberry Pi software: Common ROI capturing interface — unified region-of-interest selection across all three spectral channels.",
      "data_acquisition",
      33,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/live roi capturing.png",
      "image",
      "Raspberry Pi software: Live ROI capturing mode for real-time single-cell region-of-interest extraction from camera feed.",
      "data_acquisition",
      34,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/breightfeild iamging.png",
      "image",
      "Raspberry Pi software: Brightfield imaging module for cell segmentation reference — provides morphological context for fluorescence analysis.",
      "experimental_setup",
      35,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/segmentaion on edge.png",
      "image",
      "Raspberry Pi software: On-edge cell segmentation pipeline — watershed-based boundary detection running locally on Raspberry Pi 5.",
      "computational_method",
      36,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/denosing.png",
      "image",
      "Raspberry Pi software: On-edge FASCANet denoising inference — noise reduction while preserving autofluorescence textures.",
      "computational_method",
      37,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/denosing on edge wiht modl inference.png",
      "image",
      "Raspberry Pi software: On-edge denoising with full model inference pipeline — demonstrating complete local processing without cloud dependency.",
      "computational_method",
      38,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/settings and features avialable for image acqasition.png",
      "image",
      "Raspberry Pi software: Settings and configuration panel for image acquisition — exposure, gain, LED intensity, and spectral channel selection.",
      "experimental_setup",
      39,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/noraml cell.png",
      "image",
      "Raspberry Pi software: Classification output — normal cell detection result showing cancer probability scoring from CAFNet-Hybrid model.",
      "results",
      40,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/cancer cell.png",
      "image",
      "Raspberry Pi software: Classification output — cancer cell detection result showing elevated cancer probability from on-edge AI screening.",
      "results",
      41,
    );
    await insertMedia(
      microscopeId,
      "/research/microscope/raspi/smoker cell.png",
      "image",
      "Raspberry Pi software: Classification output — smoker cell detection result showing intermediate risk profile in the ordered probability continuum.",
      "results",
      42,
    );

    // Coal Volume Estimation
    await insertMedia(
      coalId,
      "/research/coal-volume/scan_map.png",
      "image",
      "ROS 2 sensor-fusion scan map — YOLO-segmented coal occupancy with LiDAR depth profiling.",
      "computational_method",
      1,
    );
    await insertMedia(
      coalId,
      "/research/coal-volume/session_20260801_220024.png",
      "image",
      "Conveyor belt scanning session — real-time volumetric and mass flow-rate measurement.",
      "experimental_setup",
      2,
    );
    await insertMedia(
      coalId,
      "/research/coal-volume/WhatsApp Image 2026-08-21 at 13.58.34.jpeg",
      "image",
      "Industrial conveyor system with PiCamera2 and RPLIDAR sensor mounted above belt.",
      "hardware",
      3,
    );

    // ECG Cannabis Detection
    await insertMedia(
      ecgId,
      "/research/ecg-cannabis-detection/corer.png",
      "image",
      "Scatterplot matrix of extracted ECG features.",
      "results",
      1,
    );
    await insertMedia(
      ecgId,
      "/research/ecg-cannabis-detection/download.png",
      "image",
      "Mean accuracy comparison across ECG classifiers.",
      "results",
      2,
    );
    await insertMedia(
      ecgId,
      "/research/ecg-cannabis-detection/feature-extraction.png",
      "image",
      "Original and baseline-corrected ECG signals.",
      "methodology",
      3,
    );
    await insertMedia(
      ecgId,
      "/research/ecg-cannabis-detection/classifier-results.png",
      "image",
      "ECG recording with annotated P, QRS, and T wave delineation.",
      "methodology",
      4,
    );

    console.log("✅ Project media created");

    console.log("🎉 Database seed check complete!");
    await query("COMMIT");
  } catch (error) {
    await query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const isSeedMain =
  process.argv[1] &&
  (process.argv[1].endsWith("seed.ts") || process.argv[1].endsWith("seed.js"));

if (isSeedMain) {
  seedDatabase().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
}
