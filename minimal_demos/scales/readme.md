# Arpeggio Practice Generator

This is a demo project that generates scale diagrams for arpeggio practice using the CAGED system. The application is built with JavaScript and uses the following libraries:

- [@moonwave99/fretboard.js](https://github.com/moonwave99/fretboard.js) for rendering the fretboard.
- [Tonal](https://github.com/tonaljs/tonal) for music theory utilities.

## Features

- **Select Key**: Choose the root key for the scale.
- **Select Scale Type**: Choose from various scale types like Major, Minor, Pentatonic, etc.
- **Select CAGED Shape**: Choose the CAGED shape to visualize on the fretboard.
- **Generate Scale Diagram**: Render the scale diagram based on your selections.

## Getting Started

### Prerequisites

- **Node.js**: Ensure you have Node.js installed. You can download it from the [official website](https://nodejs.org/).
- **npm**: Comes bundled with Node.js.

### Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/vncntprvst/ArpeggioFlow.git
   ```

2. **Navigate to the Project Directory**

   ```bash
   cd ArpeggioFlow/minimal_demos/scales
   ```

3. **Initialize npm**

   ```bash
   npm init -y
   ```

4. **Install Parcel as a Dev Dependency**

   ```bash
   npm install --save-dev parcel
   ```

5. **Install Project Dependencies**

   ```bash
   npm install tonal @moonwave99/fretboard.js
   ```

6. **Clean Parcel Cache (Optional)**

   If you encounter issues, you might need to remove Parcel's cache:

   - **For Windows:**

     ```bash
     rd /s /q .parcel-cache
     ```

   - **For macOS/Linux:**

     ```bash
     rm -rf .parcel-cache
     ```

### Update `package.json`

Your `package.json` in the root folder should look like this:

```json
{
{
  "name": "arpeggioflowapp",
  "version": "1.0.0",
  "description": "**Arpeggio Flow** is a web application designed to help musicians practice arpeggios based on different keys, chord progressions, and chord shapes. It leverages [VexFlow](https://www.vexflow.com/) for rendering musical notation and [Tonal.js](https://github.com/tonaljs/tonal) for music theory calculations.",
  "main": "flow.js",
"scripts": {
  "start": "parcel minimal_demos/scales/index.html",
  "build": "parcel build minimal_demos/scales/index.html"
},
  "keywords": [],
  "author": "Vincent Prevosto",
  "license": "ISC",
  "devDependencies": {
    "parcel": "^2.12.0"
  },
  "dependencies": {
    "@moonwave99/fretboard.js": "^0.2.13",
    "tonal": "^6.2.0"
  }
}
```

### Running the Application

1. **Start the Development Server**

   ```bash
   npm start
   ```

   This command runs `parcel index.html`, which starts the development server. Parcel typically serves the application on `http://localhost:1234` by default.

### Accessing the Application

Open your browser and navigate to `http://localhost:1234`.

## Usage

1. **Select Your Preferences**

   - Choose a key from the "Select Key" dropdown.
   - Choose a scale type from the "Select Scale Type" dropdown.
   - Choose a CAGED shape from the "Select CAGED Shape" dropdown.

2. **Generate the Diagram**

   Click the "Generate Scale Diagram" button to render the scale diagram on the fretboard.

## Project Structure

```
package.json
├── minimal_demos/
    ├── scales/
        ├── index.html
        ├── index.js
        ├── readme.md
```

- **index.html**: The main HTML file containing the interface.
- **index.js**: The JavaScript file handling logic and rendering.
- **package.json**: Contains project metadata and dependencies.

## Dependencies

- **[@moonwave99/fretboard.js](https://github.com/moonwave99/fretboard.js)**
- **[Tonal](https://github.com/tonaljs/tonal)**
- **[Parcel](https://parceljs.org/)** (for bundling and serving)

## Notes

- **Browser Support**: Ensure that your browser supports ES6 modules and modern JavaScript features. Use the latest version of browsers like Chrome, Firefox, or Edge.
- **Hot Reloading**: Parcel provides hot module replacement, so your changes will automatically reload in the browser.
- **Clearing Parcel Cache**: If you encounter unexpected behavior, try clearing Parcel's cache as described above.

## Troubleshooting

- **Module Not Found Errors**: Ensure you've installed all dependencies via `npm install`.
- **Server Issues**: Make sure you're running the server in the correct directory (`minimal_demos/scales`).
- **Port Conflicts**: Parcel defaults to port `1234`. If this port is in use, Parcel will automatically select another port and inform you in the console.
- **Clearing Cache**: If you experience issues, clear the Parcel cache:

  - **For Windows:**

    ```bash
    rd /s /q .parcel-cache
    ```

  - **For macOS/Linux:**

    ```bash
    rm -rf .parcel-cache
    ```

## Building for Production

To build the application for production (minified and optimized):

```bash
npm run build
```

This will generate a `dist` folder containing the bundled files, which you can deploy to a static hosting service.

## License

This project is licensed under the MIT License.

## Acknowledgments

- **[@moonwave99/fretboard.js](https://github.com/moonwave99/fretboard.js)**
- **[Tonal](https://github.com/tonaljs/tonal)**
- **[Parcel Bundler](https://parceljs.org/)**