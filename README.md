# Pulso

Pulso is a Windows desktop application that analyzes a PC's hardware and reports
what it can actually read: components, live CPU/GPU data, memory configuration,
storage health, drivers, sensors, and possible overclocking conditions.

It is built with Electron, plain HTML, CSS, and JavaScript. No frontend
framework is required.

> **Version 0.1.0.** The interface, parsers, and analysis rules are covered by
> tests and demo fixtures. The Windows-specific collectors (PowerShell/WMI,
> storage sensors, LibreHardwareMonitor, and NVIDIA queries) still need
> validation on a real Windows PC. Always check that readings match your
> hardware.

## Features

| Screen | Information |
| --- | --- |
| Summary | A high-level view of the computer and important warnings |
| Processor | Model, cores, factory frequency, live frequency, per-thread readings, and overclock status |
| Graphics | GPU model, VRAM, installed driver, power, and live clock through `nvidia-smi` |
| Memory | Modules, type, rated speed, configured speed, and XMP/DOCP or manual overclock detection |
| Storage | SMART health and estimated SSD wear; HDD health, errors, and power-on hours |
| Motherboard | Manufacturer, model, chipset, and BIOS |
| Sensors | Fan speeds, temperatures, and voltages when LibreHardwareMonitor is available |
| Drivers | Installed versions compared with available information |
| Overclock | An explainable assessment of CPU, RAM, motherboard, cooling, PSU, and temperatures |
| My PC | User-provided details Windows cannot detect, such as cooler, PSU, and case |

The toolbar includes **Rescan** and **Export report**. Reports are exported as
JSON files containing the data collected by Pulso.

## How overclock detection works

Pulso uses explicit, inspectable rules rather than AI:

- **CPU:** the highest sustained live frequency in the current session is
  compared with the official boost frequency in Pulso's CPU database. A value
  above the boost by more than 2.5% is reported as an overclock.
- **RAM:** the configured speed is compared with the module's rated SPD/XMP
  speed.
- **Assessment:** the final recommendation also considers the motherboard
  chipset, whether the CPU multiplier is unlocked, the manually entered cooler
  and PSU, and observed temperatures.

CPU readings are most useful while the processor is under load. A frequency
below the factory boost cannot be identified as an overclock without access to
voltage and multiplier data.

## Requirements

- Windows for hardware collection.
- Node.js 22 or newer for development.
- LibreHardwareMonitor is optional and is only needed for motherboard sensors.

## Development

1. Install [Node.js](https://nodejs.org/) 22 or newer.
2. Clone this repository and open it in VS Code.
3. Install dependencies:

   ```sh
   npm install
   ```

4. Start Pulso:

   ```sh
   npm start
   ```

Useful commands:

```sh
npm run start:demo       # Run with example data on any supported desktop OS
npm run start:demo -- --demo-oc
npm test                 # Run the fixture-based test suite
npm run probe            # Save raw machine data to pulso-probe.json
```

The VS Code launch profiles also include:

- **Pulso (real PC):** collect hardware from the current Windows machine.
- **Pulso (demo mode):** use deterministic example data.
- **Pulso (demo overclock + DevTools):** show the overclock state and open DevTools.

## LibreHardwareMonitor sensors

To display fan speeds, temperatures, and voltages:

1. Download [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases).
2. Run it as administrator.
3. Enable **Options → Remote Web Server → Run**.
4. Open or rescan Pulso.

Pulso connects only to the local LibreHardwareMonitor web server. The rest of
the application works without it.

## Build Windows installers

```sh
npm run dist
```

This creates the following files in `dist/`:

- `Pulso-Setup-0.1.0.exe`: an installer with shortcuts and a selectable
  installation directory.
- `Pulso-Portable-0.1.0.exe`: a portable executable that stores its data in a
  `pulso-data` folder beside the executable.

The GitHub Actions workflow can build these artifacts on Windows. Run it
manually from **Actions → Compilar para Windows**, or push a tag such as
`v0.1.0` to build and publish a GitHub Release.

The executables are not digitally signed. Windows SmartScreen may therefore
show a warning for downloaded builds.

## Limitations

- Windows cannot identify the physical CPU cooler, PSU, or case; these are
  entered in **My PC** and used by the assessment rules.
- CPUs do not have a conventional driver. Pulso reports chipset drivers and
  BIOS information instead.
- Automatic latest-version checks are limited. NVIDIA has an online query;
  chipset, BIOS, AMD, and Intel entries show the installed version and official
  links where available.
- Windows does not expose all temperatures, voltages, or fan data directly.
  LibreHardwareMonitor is required for those readings.
- The Windows collectors and third-party sensor/API formats have not yet been
  fully validated on every hardware configuration.

If a value looks wrong, run `npm run probe` and provide the resulting
`pulso-probe.json`, or export a report from the application. This gives the raw
input needed to improve a parser without guessing.

## Project structure

```text
src/main/
  main.js                 Electron window, IPC, and scan lifecycle
  collectors/             Windows, demo, NVIDIA, and LibreHardwareMonitor readers
  analysis/               Overclock, storage health, sensors, and reports
  drivers/                Driver version comparison and NVIDIA lookup
  data/                   CPU specifications and NVIDIA device data
src/renderer/              HTML interface and view modules
test/                      Fixture-based Node.js tests
scripts/                   Probe, icon, and font utilities
.github/                  GitHub Actions workflow for Windows builds
```

## License

Pulso is distributed under the [MIT License](./LICENSE).
