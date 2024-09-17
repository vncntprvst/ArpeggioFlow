### Testing

**Local implementation**:  
Modern browsers enforce the Same-Origin Policy (SOP), which blocks loading modules from the local file system (file:// protocol) due to security reasons. To work around this, we need to serve the HTML and JavaScript files from an HTTP(S) server instead of accessing them directly from the file system.
```
cd /path/to/this/repo
python -m http.server
```
Then open your browser and go to: http://localhost:8000/