# Rebecca's handover guide

`guide.html` is the source; `./build.sh` renders it to `../HANDOVER.pdf` with
headless Chrome (A4, Anton + Nunito from Google Fonts). Both the PDF and the
`shots/` screenshots are gitignored: the repo is public and they contain
personal details. Keep the PDF with the family, not on GitHub.

Re-taking a Stripe screenshot: macOS screen capture is not available to Claude,
so the shots are DOM snapshots of the live dashboard rendered by headless
Chrome. From the page in Chrome, copy the snapshot HTML to the clipboard
(the `__snapHtml` routine in the session that built this), then
`./clip.sh NAME [height]` renders it and `./crop.sh IN OUT X Y W H` crops in
CSS pixels. `render1.sh` re-renders a saved snapshot.
