# 🧸 Screen Toys (`screen.toys`)

> A curated collection of interactive 3D visual toys, physics sandboxes, ambient graphics, and web novelties created by **Gavin Shapiro** ([@shapiro500](https://github.com/shapiro500)).

[![Website](https://img.shields.io/badge/Web-screen.toys-8A2BE2?style=for-the-badge&logo=googlechrome&logoColor=white)](https://screen.toys)
[![GitHub Repository](https://img.shields.io/badge/GitHub-shapiro500%2Fscreentoys-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/shapiro500/screentoys)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=for-the-badge)](CONTRIBUTING.md)

---

## 🕹️ Overview

**Screen Toys** is an ad-free, open-ended digital sandbox turning your desktop or mobile display into an interactive visual playground. Designed without traditional game loops, win/loss conditions, levels, or scores, it focuses entirely on satisfying 3D physics, tactile interactions, fluid dynamic simulations, and artistic visual experiments.

Whether you want to split firewood in zero gravity, toss chess pieces around a virtual room, or experiment with audio-reactive physics, Screen Toys delivers instantaneous WebGL experiences directly in your web browser.

Live App: **[https://screen.toys](https://screen.toys)**

---

## ✨ Included Interactive Toys

| Toy Name | Description | Key Tech / Physics Features |
| :--- | :--- | :--- |
| 🪵 **Firewood Splitting Simulator** | Interactive 3D log-splitting physics experience. Chop, slice, and send wood chips flying. | Rigid Body Fracture, Mesh Splitting, Custom Colliders |
| ♟️ **Chess 2** | A fully interactive 3D chessboard where traditional rules are secondary to throwing pieces around. | Impulse Forces, Gravity Controls, Friction Dynamics |
| 🚗 **Road Trip** | An endless low-poly terrain simulator allowing real-time spawning of vehicles and obstacles. | Heightmap Terrain, Raycast Vehicle Physics |
| 📣 **Poms Visualizer** | Fluffy, audio-reactive pom-pom particles driven by cursor drag and sound frequencies. | Verlot Integration, Audio Analyzer API, Custom Shaders |
| 🌀 **Surreal Motion Loops** | A suite of ambient, hypnotizing 3D graphics and procedural motion sculptures. | InstancedMesh, GLSL Noise, Raymarching |

---

## 🛠️ Tech Stack & Dependencies

- **Core Engine:** [Three.js](https://threejs.org/) (r160+) / WebGL 2.0
- **Physics Calculation:** [Rapier3D](https://rapier.rs/) / [Cannon-es](https://github.com/pmndrs/cannon-es)
- **Audio Processing:** Web Audio API (AnalyserNode & FFT analysis)
- **UI & State Management:** Vanilla JavaScript (ESNext Modules) & HTML5 Canvas API
- **Build System & Bundler:** [Vite](https://vitejs.dev/)
- **Deployment & Hosting:** Vercel / Cloudflare Edge Network

---

## 🚀 Local Development & Installation Guide

Follow these steps to set up and run the repository locally on your machine.

### Prerequisites

Ensure you have the following installed on your system:
- **Node.js** (`v18.0.0` or higher) -> [Download Node.js](https://nodejs.org/)
- **npm** (`v9.0.0` or higher) or **pnpm** / **yarn**
- **Git** -> [Download Git](https://git-scm.com/)

---

### Step 1: Clone the Repository

Clone the project from GitHub and navigate into the project directory:

```bash
git clone https://github.com/shapiro500/screentoys.git
cd screentoys
```

---

### Step 2: Install Project Dependencies

Install all required NPM packages:

```bash
# Using npm
npm install

# Or using pnpm
pnpm install

# Or using yarn
yarn install
```

---

### Step 3: Run Development Server

Launch the local Vite development server with hot-module replacement (HMR):

```bash
npm run dev
```

Terminal output will display your local address:

```text
  VITE v5.x.x  ready in 320 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open `http://localhost:5173` in any WebGL-enabled browser (Chrome, Firefox, Safari, Edge).

---

### Step 4: Build for Production

To create an optimized production build for deployment:

```bash
npm run build
```

The output files will be compiled into the `dist/` directory.

---

### Step 5: Preview Production Build

To test the compiled production build locally before deploying:

```bash
npm run preview
```

## 🤝 Contributing Guidelines

Contributions are what make the open-source community such an incredible place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. **Fork the Repository**
2. **Create a Feature Branch:** `git checkout -b feature/NewAwesomeToy`
3. **Commit Your Changes:** `git commit -m 'Add NewAwesomeToy'`
4. **Push to the Branch:** `git push origin feature/NewAwesomeToy`
5. **Open a Pull Request**

---

## 🎨 Author & Credits

Created and curated by **Gavin Shapiro** ([@shapiro500](https://github.com/shapiro500)) — Digital Artist, 3D Animator, and Creative Coder known for surreal loop animations, playful digital sculptures, and WebGL experiences.

- 🌐 **Official Website:** [screen.toys](https://screen.toys)
- 🐦 **X / Twitter:** [@shapiro500](https://x.com/shapiro500)
- 📸 **Instagram:** [@shapiro500](https://instagram.com/shapiro500)
- 💼 **Linktree:** [linktr.ee/shapiro500](https://linktr.ee/shapiro500)

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for more information.
