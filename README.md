# Landing Site Navigator — educational model

An interactive 2D website for comparing a landing site and date near the Moon's south pole. It shows the Sun and Earth relative to an illustrative horizon, the availability of sunlight and direct Earth communication, and proximity to a hypothetical cold trap. Everything is calculated locally in the browser. There is no backend, account, API key, or request for lunar data.

**The geometry is real, but the input data is illustrative.** A calendar date changes the scenario; the website does not predict the actual sky on that date.

## Run in PyCharm

1. Install Node.js with npm. Open the `lunar-landing-navigator` folder in PyCharm using **File → Open**.
2. Open PyCharm's **Terminal** and run `npm install`. This installs Vite and TypeScript once; internet access is needed for that step.
3. Run `npm run dev`.
4. Open the address printed in the terminal, usually [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Stop the server with `Ctrl+C`.
5. Run `npm run build` to check the production build. Its files appear in `dist/`. To view that build, run `npm run preview` and open the address printed by Vite.

After `npm install`, the website runs locally without internet access. Do not open `index.html` directly as a `file://` page; use the Vite server to load its browser modules.

## Use the navigator

- Choose one of four example sites, enter your own coordinates (latitude from −90° to −80°), or drag the marker along the illustrated horizon to adjust longitude slightly. You can rename a custom point in the coordinate panel.
- The gold **Leader** marker identifies the best-balanced of the four example sites **for the selected date and slider time**. Only sites where both the Sun and Earth are currently visible qualify. The comparison then uses `0.75 × Survival + 0.25 × Science`. If none qualifies, no leader is shown. The green outline separately marks your selected site.
- Change the landing date or move the **Lunar day** slider. The date picker changes the date; the slider adds time within a lunar cycle without rewriting that date. **Delay launch** adds 14 days.
- The **Sunlight**, **Earth**, and **Ice** switches affect the drawing only. The ice marker represents a fixed hypothetical surface point, so it does not move with time. The Sun and Earth move relative to the horizon.
- Save up to three mission cards. A card restores the name, coordinates, date, slider time, and marker position. The arrows cycle through cards; × deletes one card; **Clear all** deletes them all. Saving a fourth card replaces the oldest. Data stays in this browser's `localStorage` only.
- Sound starts only after you click the sound button. A continuous tone represents available sunlight; short pulses represent visible Earth. This is an interface cue: sound does not travel through the lunar vacuum.

## How the model works

Time `d` is counted in Earth days from **November 15, 2026**. For the observer's latitude `φ` and longitude `λ`, and the point directly below the Sun or Earth on the lunar sphere (`δ`, `λ₀`), the body's altitude above a level horizon is:

`sin(h) = sin(φ)·sin(δ) + cos(φ)·cos(δ)·cos(λ − λ₀)`.

This is the standard spherical altitude formula. The model moves the subsolar point using a **29.53 Earth-day** lunar synodic cycle, with a small seasonal latitude change of amplitude **1.54°**. An illustrative **27.3-day** oscillation of the sub-Earth point demonstrates libration. **The starting phase on November 15, 2026 and the Sun/Earth position functions are illustrative, not ephemerides.** The displayed angles and timers therefore are not astronomical predictions for the entered date.

The Sun is visible when its altitude `h☉` exceeds the point's illustrative horizon threshold; Earth is visible when `h⊕ > 0°`. The Sun label displays `h☉` **minus the threshold**, showing how far above or below the ridge it lies. The model adds no atmospheric twilight. The solar threshold is specified manually for the four example sites and varies smoothly along a notional ridge for custom points. The illustrated ridge is not a measured terrain profile.

The illustrative cold-trap distance and **Science** score vary with coordinates. Using a lunar sphere of radius **1,737.4 km**, the model finds the shortest great-circle distance (haversine formula) to the closest of four **hypothetical fixed points**. Those points are placed at the supplied demo distances of **1.2, 4, 6, and 0.3 km** from the four example sites. The score is `100 × 1.2 / (D + 1.2)`, where `D` is distance in kilometers, rounded to one decimal place. This is a continuous proximity indicator, **not an ice map or a measurement of ice**. Actual polar surface ice is patchy.

**Survival** is the percentage of the next 14 days when sunlight and direct Earth visibility coincide. The model samples 56 times at **0.25-day (six-hour)** intervals. This is a comparative score, not a spacecraft's probability of survival. **Battery** is an illustrative indicator without an electrical model. Timers also have only six-hour resolution and may miss short visibility windows.

## Limits and sources

The website does not load LOLA, LRO, JPL Horizons, SPICE, or shadow maps. Its four site coordinates are rounded for teaching, its cold traps are invented, and its local horizon mask is illustrative. A real landing decision would require measured terrain, precise ephemerides, spacecraft characteristics, and independent safety review.

References for the mathematical approach: [altitude formula — U.S. Naval Observatory](https://aa.usno.navy.mil/faq/alt_az), [Moon radius — NASA](https://science.nasa.gov/wp-content/uploads/2023/09/Earths-Moon.pdf), [lunar day and axial tilt — NASA](https://ntrs.nasa.gov/api/citations/20205007447/downloads/SLS-SPEC-159%20Cross-Program%20Design%20Specification%20for%20Natural%20Environments%20%28DSNE%29%20REVISION%20H.pdf), and [patchy polar ice — NASA JPL](https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles/). These sources do not supply this demo's starting phases, hypothetical cold-trap coordinates, or horizon thresholds.
