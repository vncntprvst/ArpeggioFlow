# Arpeggio Flow - An Arpeggio Practice Generator

## Description

**Arpeggio Flow** is a web application designed to help musicians practice arpeggios based on different keys, chord progressions, and chord shapes. It leverages [VexFlow](https://www.vexflow.com/) for rendering musical notation, [Tonal.js](https://github.com/tonaljs/tonal) for music theory calculations, and [Fretboard.js](https://moonwave99.github.io/fretboard.js) and [Vexchord](https://github.com/0xfe/vexchords) to visualize the scales and arpeggios on the guitar fretboard. The application focuses on generating sheet music for practice. An audio playback feature using [Strudel](https://strudel.cc/) is also available.

## Using the Application

1. **Fill out the form**:
   - **Exercise mode**: Choose Chord Progression Exercise or Song-Based Exercise.
   - **Key**: Select a musical key.
   - **Scale**: Choose Major or Minor.
   - **Chord Progression**: Choose a chord progression.
   - **Number of Bars**: Enter the number of bars for your exercise (e.g., 4).
   - **Song** (Song-Based mode): Pick a song to load its key, tempo, and chord progression.
   - **Chord Shape**: Select a chord shape based on the extended CAGED system (C, A, A-stretched G, E, E-stretched, D), or regular [CAGED shapes](https://appliedguitartheory.com/lessons/caged-guitar-theory-system/).
   - **Playback**: Off by default. Choose Strudel for audio playback. Tempo can be set via the BPM input.

2. **Generate the Exercise**:

   Click the **Generate Exercise** button to create your custom arpeggio practice.

3. **View the Notation**:

   The generated exercise will appear in the notation area below the form.

## Song-Based Exercises

Song metadata lives in `songs/songs.js`. Each entry includes a key, tempo, and a progression expressed as bars of chord symbols. Add additional song objects to the `SONGS` array to expand the list in the UI.

## Demo

A live version of the application is hosted on GitHub Pages: [Arpeggio Flow](https://vncntprvst.github.io/ArpeggioFlow/)

## Installation

The application is a single-page web app that consists of HTML, CSS, and JavaScript files. Serve `index.html` over HTTP to run it locally.

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari) that supports ES6 modules.
- [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed (optional, for running tests, linting, or a Parcel dev server).

e.g., for Windows:

1. **Download Node.js for Windows:**
   - Visit the official Node.js website: [https://nodejs.org/en/download/](https://nodejs.org/en/download/)
   - Click on the **Windows Installer** option (e.g., **64-bit**).
   - Save the installer file to your computer.

2. **Run the Installer:**
   - Locate the downloaded `.msi` file and double-click it.
   - Follow the prompts in the installation wizard.
   - Accept the license agreement.
   - Use the default installation settings.
   - Ensure that the **"Add to PATH"** option is selected so you can run `node` and `npm` from the command line.

3. **Verify Installation:**
   - Open **Command Prompt** or **PowerShell**:
     - Press `Win + R`, type `cmd`, and press **Enter**.
   - Check Node.js version:

     ```cmd
     node -v
     ```

     You should see the version number printed (e.g., `v18.0.0`).

   - Check npm version:

     ```cmd
     npm -v
     ```

     You should see the npm version number printed.

From there, you can install dependencies with `npm install` and optionally run `npm run start` to launch the Parcel dev server.

### Clone the Repository

```bash
git clone https://github.com/vncntprvst/ArpeggioFlow.git
cd ArpeggioFlow
```

### Running the Application Locally

Due to browser security policies (CORS and the Same-Origin Policy), you cannot run this application by opening the `index.html` file directly from the file system. Instead, you need to serve it over HTTP.

**Using Python's Simple HTTP Server**

If you have Python installed, you can use its built-in HTTP server:

```bash
cd /path/to/ArpeggioFlow
python -m http.server 8000
```

**[Alternatively] Using Node.js and http-server**
If you prefer using Node.js:

```bash
npm install -g http-server
http-server -p 8000
```

**Access the application**:
Open your web browser and go to [http://localhost:8000](http://localhost:8000).

**[Optional] Using Parcel**
If you prefer Parcel:

```bash
npm install
npm run start
```

## Playback (Strudel)

Strudel integration is scaffolded for bundler use (Parcel/Vite). The UI includes a Playback selector, but the note-to-pattern adapter still needs to be wired.

Dependencies are declared in `package.json` with wildcard versions; run `npm install` to lock actual versions in `package-lock.json`.

Tempo is controlled via the BPM input in Step 4. The generated notes are spread across measures so longer progressions do not play faster.

### Building libraries

e.g., freatboard.js

```bash
cd /path/to/fretboard.js
npm install
npm run build
```
Copy the cjs / esm / umd files to the `libs\fretboard` directory.
