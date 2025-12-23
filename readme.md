# Arpeggio Flow - An Arpeggio Practice Generator

## Description

**Arpeggio Flow** is a web application designed to help musicians practice arpeggios based on different keys, chord progressions, and chord shapes. It leverages [VexFlow](https://www.vexflow.com/) for rendering musical notation and [Tonal.js](https://github.com/tonaljs/tonal) for music theory calculations. The application focuses solely on generating sheet music for practice; it does not include audio playback.

## Using the Application

1. **Fill out the form**:
   - **Key**: Select a musical key.
   - **Scale**: Choose Major or Minor.
   - **Chord Progression**: Choose a chord progression.
   - **Number of Bars**: Enter the number of bars for your exercise (e.g., 4).
   - **Chord Shape**: Select a chord shape based on the CAGED system (C, A, G, E, D).

2. **Generate the Exercise**:

   Click the **Generate Exercise** button to create your custom arpeggio practice.

3. **View the Notation**:

   The generated exercise will appear in the notation area below the form.

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

### Building libraries

e.g., freatboard.js

```bash
cd /path/to/fretboard.js
npm install
npm run build
```
Copy the cjs / esm / umd files to the `libs\fretboard` directory.
