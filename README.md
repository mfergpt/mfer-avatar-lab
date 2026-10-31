# mfer lab

A single-page home for things I'm experimenting with. Experiment 001 is Halloween: costumes, themed hoodies, expressive faces, and mixable outfits.

The public site contains the 3D playground only. The original local trait lab, its audit tools, Blender source files, and QA reports remain in the parent workspace.

## Develop and build

Use Node 22, then `npm ci` and `npm run dev`. `npm run build` creates a standalone `dist/` directory. `npm run preview` serves that build at http://127.0.0.1:5190/.

The app includes its own avatar runtime, base GLB, additive costume GLB, font, and locally served tracking models. It does not depend on sibling directories or the production creator. Camera capture is optional, requests no microphone, and processes frames in the browser. Stop, page hide, and tab hide release capture.

## Publish

The GitHub Actions workflow deploys the `codex/halloween-lab` branch to GitHub Pages. Enable Pages with GitHub Actions as the source. The intended custom domain is `lab.mferavatars.xyz`.

Set a DNS CNAME for `lab` to the owning GitHub account's `<account>.github.io`, then set the custom domain in repository Pages settings and enable HTTPS once GitHub has issued the certificate. This is a separate Pages site from the existing creator and playground.

Only `public/` and bundled application files enter the build; local status/audit pages are not included.

## Animated download

The viewer’s Download GLB button bakes six seconds of the displayed animation into a loop, including the base and costume rigs, facial morphs, and spring motion. Only selected geometry and the dormant tongue are included. Keep the tab visible while preparing the file. Downloaded motion plays in standard GLB viewers without the lab runtime. `npm test` verifies both skins, facial animation, selected-mesh filtering, round-trip deformation, and source preservation.
