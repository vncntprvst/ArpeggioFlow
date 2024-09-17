# Arpeggio Flow - An Arpeggio Practice Generator

## Description

**Arpeggio Flow** is a web application designed to help musicians practice arpeggios based on different keys, chord progressions, and chord shapes. It leverages [VexFlow](https://www.vexflow.com/) for rendering musical notation and [Tonal.js](https://github.com/tonaljs/tonal) for music theory calculations.

## Using the Application

1. **Fill out the form**:

   - **Key**: Select a musical key.
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
The application is a single-page web app that consists of HTML, CSS, and JavaScript files. You can run it locally by opening the `index.html` file in your web browser.  

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari) that supports ES6 modules.
- [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed (optional, for running a local server with more features).

### Clone the Repository

```bash
git clone https://github.com/vncntprvst/ArpeggioFlow.git
cd ArpeggioFlow
```

### Running the Application Locally

Due to browser security policies (CORS and the Same-Origin Policy), you cannot run this application by opening the `index.html` file directly from the file system. Instead, you need to serve it over HTTP.

#### Using Python's Simple HTTP Server

If you have Python installed, you can use its built-in HTTP server:

1. **Navigate to the project directory**:

   ```bash
   cd /path/to/ArpeggioFlow
   ```

2. **Start the server**:

   - For Python 3.x:

     ```bash
     python -m http.server 8000
     ```

   - For Python 2.x:

     ```bash
     python -m SimpleHTTPServer 8000
     ```

3. **Access the application**:

   Open your web browser and go to [http://localhost:8000](http://localhost:8000).

#### Using Node.js and http-server (Optional)

If you prefer using Node.js:

1. **Install http-server**:

   ```bash
   npm install -g http-server
   ```

2. **Start the server**:

   ```bash
   http-server -p 8000
   ```

3. **Access the application**:

   Open your web browser and go to [http://localhost:8000](http://localhost:8000).
