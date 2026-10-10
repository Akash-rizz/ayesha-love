AMBIENT MUSIC — OPTIONAL
========================

Nothing in this folder is required. The site ships with music OFF and never
pretends to play something that isn't there: the Music button stays visible
but is marked disabled and explains itself when clicked.

How to switch music on
----------------------
1. Put a properly LICENSED audio file here, for example:

       assets/audio/ambient.mp3

   Good sources of free/royalty-free ambient tracks: your own recordings,
   CC0 / CC-BY tracks, or a library you have paid for. Read the licence —
   some "free" tracks are only free for personal use, and some require
   attribution. This is a private gift, but the licence still applies.

2. Open ../script.js, find SECTION 1 → CONFIG → audio, and set:

       src: 'assets/audio/ambient.mp3'

   (keep the quotes). Adjust `volume` (0–1) and `fadeMs` if you like.

3. Reload the page. The Music button now starts and stops playback, fades
   the volume in, loops the track, and reports real errors if the file is
   missing or blocked.

Formats
-------
mp3 and m4a/aac work almost everywhere; ogg/flac work on most but not all
mobile browsers. If playback fails you will see "The audio file could not be
played." — try another format.

Files served over https:// (GitHub Pages) must also be served with the right
MIME type; static hosts do this automatically for .mp3.
