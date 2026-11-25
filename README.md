# Virtual Photo Museum

Upload as many photos as you like, click **Generate My Museum**, and walk through a 3D gallery where every photo hangs on a wall. Everything runs in your browser. Nothing is uploaded anywhere.

## Run it

**Easiest:** unzip and double-click `index.html`. The 3D engine is already bundled into `museum.js`, so it works offline with no server.

If your browser blocks anything when opened from disk, serve the folder instead:

```bash
npx serve .          # or: python3 -m http.server 8000
```

## How it works

1. **Upload:** drag and drop photos (or browse). Thumbnails appear with a title field (this becomes the wall plaque) and a remove button.
2. **Generate My Museum:** the museum is built with 6 photos per room (3 on the north wall, 3 on the south wall). Rooms are added automatically and joined by doorways. Photos keep their aspect ratio.
3. **Explore:** walk around as a 3D character. Walk up to a photo and press **E** for a full-screen view with previous/next arrows.

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Walk | `W A S D` or arrow keys | Left joystick |
| Run | `Shift` | **Run** button (toggle) |
| Look | Mouse (click the scene to capture it, `Esc` to release). Click-and-drag also works. | Drag on the right side of the screen |
| View photo | `E` near a photo | **View** button |
| 1st / 3rd person | `V` or the Camera button | Camera button |
| In the photo viewer | `←` `→` to browse, `Esc` to close | Arrow buttons, ✕ |

HUD buttons: **Back to upload**, **Add photos** (adds to the current museum and keeps your position), a **style** switcher (Classic, Modern, Dark), and a **Sound** toggle for the ambient music and footsteps. The round minimap shows your position, view direction and where the photos are.

## Project layout

```
index.html      page markup (upload screen, HUD, viewer, touch controls)
style.css       all styling
museum.js       bundled build output (Three.js + app); this is what index.html loads
src/main.js     application source (readable, commented)
package.json    build scripts
```

## Developing

```bash
npm install
npm run build     # bundles src/main.js -> museum.js
npm run watch     # rebuild on change (with sourcemap)
```

Handy constants at the top of `src/main.js`: room size, photos per room (`PER_ROOM`), maximum photo size on the wall, texture sizes, and the three theme palettes in `THEMES`.

## Performance notes

- Each photo is re-encoded once on upload (2048 px for the viewer, 1280 px for the wall). Only compressed data stays in memory.
- GPU textures are loaded lazily for the room you are in and its neighbours, and released again when you walk far away, so large uploads stay smooth.
- Rooms more than two away from you are not drawn. A fixed pool of 4 lights follows you instead of one light per photo.

## Notes and limits

- Supported formats: JPG, PNG, WebP, GIF (first frame), AVIF, BMP. HEIC isn't decodable by most browsers; convert it to JPG first. Unsupported or unreadable files are skipped with a message.
- The museum lives in the page, so refreshing the tab clears it. Saving or sharing a museum by link would need a backend (or a downloadable export), which isn't included.
- Requires a browser with WebGL. If it isn't available you'll see a message.
- Open `index.html?debug` to expose `window.__museum` in the console for inspecting or teleporting during development.
