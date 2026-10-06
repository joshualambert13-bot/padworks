// The introduction's default script (Drop 77): the camera preset per stop and the line said there. The editable
// copy lives in content/narration.json (Drop 84); this is what scripts/narration-export.mjs starts from and what
// the demo falls back to when a line is missing there. Pure data, so node scripts can import it without the scene.
export const INTRO = [
  { preset: 'pad', text: 'Welcome to Padworks. This is a multi-well frac pad, drawn from generic equipment at real proportions. The simulator runs the whole completion: wireline, fracturing, drillout, flowback and the production hookup. Let us walk the pad.' },
  { preset: 'tree', text: 'The frac tree. Lower and upper master valves, the cross with a wing valve each side, the crown valve, and the swab valve on top for lubricator access. Every valve here is live in the simulator, and the interlocks between them are the first thing the lessons teach.' },
  { preset: 'row', text: 'The wellhead row. Each well gets its own tree, and the colors on the valve bodies match the colors on the zipper leg that feeds it, so you can follow a flow path from the manifold to the well.' },
  { preset: 'zipper', text: 'The zipper manifold. The treating line from the missile comes into the inlet isolation valve; each well has a leg with an isolation valve and a working valve. Opening and closing legs is how one frac spread serves several wells without breaking a connection.' },
  { preset: 'pumps', text: 'The pump row and the missile. Pump trucks park nose-in on both sides of the manifold trailer. Low-pressure suction on the outside, high-pressure discharge down the centerline, the relief valve set below the iron rating.' },
  { preset: 'sand', text: 'The sand side. Silos or boxes feed the conveyor to the blender, where water, sand and chemicals become slurry. Proppant concentration is the number you will watch most when you pump a stage.' },
  { preset: 'tanks', text: 'Water. A lined pit, tanks, or storage tanks depending on the basin, with the transfer pump and the lay-flat line to the blender. In winter the Bakken adds a heater on the discharge.' },
  { preset: 'support', text: 'Support: the data van where the job is run, the fuel row, light plants, the chemical totes, and the crew. Everything on the pad opens a record in the library when you hover and click it.' },
  { preset: 'gate', text: 'The gate and the lease road. Trucks come and go through here; the lanes and ruts on the pad come from where they actually drive.' },
  { preset: 'flowback', text: 'Flowback. After drillout the well flows through the choke manifold to the separator and the tanks, and the flare stack takes the gas until the sales line is tied in.' },
  { preset: 'pad', text: 'That is the pad. Press Lessons to be walked through a job one checkpoint at a time, with a score; press Full simulator to run it your own way. Hover anything to name it; click to open its record.' },
];
