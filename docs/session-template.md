# Session template

Each working session with the AI assistant has one packet: ten records or one assembly or one platform change. Start the session by pasting this filled in.

```
Packet: <records | assembly | platform>
IDs: <list of record IDs or the assembly ID>
Inputs from me: <dimensions, corrections, photos, decisions>
Standards I hold: <list, or none>
What is wrong since last time: <paste errors, describe what looked wrong on laptop and phone>
Done means: <records at draft with citations | GLB in the viewer with cut-away | feature works on phone>
```

The assistant returns files to drop into the repository and the exact commands to run. End every session with `npm run validate`, `npm run build`, and a commit.

Review sessions are separate from drafting sessions. In a review session, open the record JSON files, read every tab, check citations, and change `status` and `reviewers` yourself.
