# LuNaVi

The site is already up: [diachenkodenis.github.io/lunavi](https://diachenkodenis.github.io/lunavi/)

Near the Moon's south pole, a landing site can look fine and then go dark. Move it a few kilometers, or slip the date by a day, and the Sun drops behind the ridge. That is the power. If Earth drops too, the direct radio link goes with it.

LuNaVi is a page for trying that out. Pick a crater and a date, watch both bodies on one horizon, then move the date and see what is left.

The sky here is a flat-horizon sketch that runs in the browser. Use it to compare one scenario with another. The angles are not a forecast of the real sky on that calendar day. We never call LOLA, LRO, or JPL Horizons.

## What the page does

Four craters are already listed: Shackleton, Mouton, Malapert, and Cabeus. You can type your own point too, anywhere from 90°S to 80°S, and give it a name. Drag the marker on the horizon if you only want to nudge the longitude.

The date picker is the landing day. The lunar-day slider walks through the cycle and leaves that date alone. **Delay launch** adds 14 days.

The Sunlight, Earth, and Ice switches only change the drawing. The ice mark stays where it was placed. The Sun and Earth move.

**Science** is how close the point sits to a cold trap we placed by hand. Changing the date does not move it. **Survival** is the share of the next 14 days when the Sun and Earth are both up. **Battery** rises while the Sun clears the ridge and falls once it sets. These are scores for comparing sites, the way a planner might glance at them. They are not a lander design.

**Save mission card** keeps up to three snapshots in this browser: the name, the coordinates, the date, the slider, and the marker. Saving a fourth card drops the oldest. **Clear all** removes them. Nothing is sent anywhere.

**Play the horizon** starts the sound, and only after you click it. A low tone plays while the Sun is up. A short pulse plays while Earth is in view. Each one stops the moment that body sets. On the Moon there is no air, so we cut the sound off instead of letting it fade.

## Where the numbers come from

Time is counted in Earth days from 15 November 2026. For a site at latitude φ and longitude λ, the altitude of the Sun or Earth over a level horizon is the usual one:

`sin(h) = sin(φ) sin(δ) + cos(φ) cos(δ) cos(λ − λ₀)`

δ and λ₀ are the latitude and longitude of the point on the Moon directly under that body.

The Sun goes around once every 29.53 Earth days, and its latitude wobbles by about 1.54° through the year. Earth shifts on a 27.3-day libration, by up to about 6°. The phase on 15 November 2026 is an anchor we picked so the demo has a rhythm. A real ephemeris would put the bodies somewhere else.

The Sun counts as up only after it clears that site's ridge. On the four craters those ridges are 0.5°, 1.5°, 1.0°, and 2.0°. A point you type in gets a ridge that varies along an imaginary line. Earth counts as up above 0°. The Sun label shows how far it sits above or below the ridge. There is no atmosphere in the model, so there is no twilight either.

The four cold traps sit 1.2 km, 4 km, 6 km, and 0.3 km from those craters. A custom point uses whichever of those traps is closest, measured on a Moon 1,737.4 km across. Science is `100 × 1.2 / (D + 1.2)`, with D in kilometers, rounded to one decimal. Closer is higher. We placed the traps so the score would have a shape. Polar ice on the real Moon is patchy, and this is not a map of it.

Survival checks the next 14 days every six hours, 56 times, and counts the steps where both bodies are up. A window shorter than six hours can slip through. While the Sun is up, battery is `70 + 10 × (sun angle − ridge)`, held between 70 and 100. In the dark it starts at 40 and drops by 5 for each day the shadow has already lasted, down to 5.

## Reading list

The altitude formula is the standard one from the [U.S. Naval Observatory](https://aa.usno.navy.mil/faq/alt_az). The Moon's radius is from [NASA](https://science.nasa.gov/wp-content/uploads/2023/09/Earths-Moon.pdf). The length of a lunar day and the 1.54° tilt are in NASA's [cross-program natural environments spec](https://ntrs.nasa.gov/api/citations/20205007447/downloads/SLS-SPEC-159%20Cross-Program%20Design%20Specification%20for%20Natural%20Environments%20%28DSNE%29%20REVISION%20H.pdf). Patchy polar ice is described by [NASA JPL](https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles/).

Those pages did not give us the starting phase, the cold-trap coordinates, or the ridge heights. A real landing call still needs measured terrain, a real ephemeris, and a spacecraft team.
