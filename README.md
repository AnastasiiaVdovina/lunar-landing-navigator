# LuNaVi

Open the project here: [diachenkodenis.github.io/lunavi](https://diachenkodenis.github.io/lunavi/)

Near the Moon's south pole, sunlight is power and a clear view of Earth is the direct radio link. Move the landing site a few kilometers, or slip the date by a day, and either one can drop behind the ridge.

LuNaVi puts both on one horizon. Pick a crater and a date, then move forward and see what is still above the line.

The sky is a flat-horizon sketch that runs in the browser. It is for comparing scenarios. The angles are not a forecast for that calendar day, and the page does not call LOLA, LRO, or JPL Horizons.

## On the page

Four craters are listed: Shackleton, Mouton, Malapert, and Cabeus. You can type your own point from 90°S to 80°S and name it. Drag the marker on the horizon to nudge the longitude.

The date is the landing day. The lunar-day slider moves through the cycle without changing that date. **Delay launch** adds 14 days.

Sunlight, Earth, and Ice only change the drawing. The ice mark stays put. The Sun and Earth move.

**Science** is distance to a cold trap we placed by hand. The date does not move it. **Survival** is how much of the next 14 days has both the Sun and Earth up. **Battery** rises while the Sun clears the ridge and falls after it sets. These scores compare sites. They are not a lander design.

**Save mission card** keeps up to three snapshots in this browser. A fourth save drops the oldest. **Clear all** removes them.

**Play the horizon** starts the sound after you click it. A low tone plays while the Sun is up. A short pulse plays while Earth is in view. Each one stops when that body sets.

## Where the numbers come from

Days are counted from 15 November 2026. Altitude over a level horizon is the usual formula:

`sin(h) = sin(φ) sin(δ) + cos(φ) cos(δ) cos(λ − λ₀)`

The Sun goes around once every 29.53 Earth days, with about 1.54° of seasonal tilt. Earth shifts by up to about 6° on a 27.3-day libration. The phase on 15 November 2026 is an anchor for the demo. A real ephemeris would place the bodies differently.

The Sun counts as up only after it clears that site's ridge: 0.5° at Shackleton, 1.5° at Mouton, 1.0° at Malapert, and 2.0° at Cabeus. A typed-in point gets a ridge that varies along an imaginary line. Earth counts as up above 0°. There is no atmosphere in the model, so there is no twilight.

The cold traps sit 1.2 km, 4 km, 6 km, and 0.3 km from those craters. Science is `100 × 1.2 / (D + 1.2)`, closer scoring higher. The traps are placed so the score has a shape. They are not a map of ice.

Survival checks the next 14 days every six hours. A shorter window can be missed. In sunlight, battery is `70 + 10 × (sun angle − ridge)`, held between 70 and 100. In the dark it starts at 40 and drops from there, down to 5.

## Sources

Altitude formula: [U.S. Naval Observatory](https://aa.usno.navy.mil/faq/alt_az). Moon radius: [NASA](https://science.nasa.gov/wp-content/uploads/2023/09/Earths-Moon.pdf). Lunar day and the 1.54° tilt: [NASA natural environments spec](https://ntrs.nasa.gov/api/citations/20205007447/downloads/SLS-SPEC-159%20Cross-Program%20Design%20Specification%20for%20Natural%20Environments%20%28DSNE%29%20REVISION%20H.pdf). Patchy polar ice: [NASA JPL](https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles/).

Those pages did not supply the starting phase, the cold-trap coordinates, or the ridge heights.
