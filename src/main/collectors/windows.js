'use strict';
// Recolector para Windows: consulta WMI/CIM con PowerShell (funciona igual en Windows en
// español, porque usa nombres de clase y no contadores traducidos).
const { runJson, streamLines } = require('./powershell');
const {
  asArray, clean, num, clamp, MEMORY_TYPES, memoryVendor, nvidiaUserVersion,
  cleanCpuName, chipsetFromBoard, shortBoardVendor, toIsoDate,
} = require('./util');

// ---------------------------------------------------------------------------
// Scripts PowerShell
// ---------------------------------------------------------------------------

const STATIC_SCRIPT = String.raw`
$r = [ordered]@{}
$r.cpu = @(Get-CimInstance Win32_Processor | Select-Object Name,Manufacturer,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,CurrentClockSpeed,L2CacheSize,L3CacheSize,SocketDesignation)
$r.gpu = @(Get-CimInstance Win32_VideoController | Select-Object Name,AdapterCompatibility,AdapterRAM,DriverVersion,@{n='DriverDate';e={ if($_.DriverDate){ $_.DriverDate.ToString('yyyy-MM-dd') } }},PNPDeviceID)
$r.gpuMem = @(Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0*' | Select-Object DriverDesc,@{n='Mem';e={ $_.'HardwareInformation.qwMemorySize' }})
$r.ram = @(Get-CimInstance Win32_PhysicalMemory | Select-Object DeviceLocator,BankLabel,Manufacturer,PartNumber,Capacity,Speed,ConfiguredClockSpeed,ConfiguredVoltage,SMBIOSMemoryType,MemoryType)
$r.ramSlots = @(Get-CimInstance Win32_PhysicalMemoryArray | Select-Object MemoryDevices,MaxCapacity)
$r.board = @(Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product,Version)
$r.bios = @(Get-CimInstance Win32_BIOS | Select-Object Manufacturer,SMBIOSBIOSVersion,@{n='ReleaseDate';e={ if($_.ReleaseDate){ $_.ReleaseDate.ToString('yyyy-MM-dd') } }})
$r.os = @(Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,OSArchitecture)
$r.machine = @(Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer,Model,TotalPhysicalMemory,Name)
$r.disks = @(Get-PhysicalDisk | ForEach-Object {
  $d = $_
  $c = $null
  try { $c = $d | Get-StorageReliabilityCounter } catch {}
  [pscustomobject]@{
    Id = [string]$d.DeviceId; Name = $d.FriendlyName; MediaType = [string]$d.MediaType; BusType = [string]$d.BusType
    Size = $d.Size; Health = [string]$d.HealthStatus; Operational = (@($d.OperationalStatus) -join ',')
    Wear = $c.Wear; Temp = $c.Temperature; Hours = $c.PowerOnHours
    ReadErr = $c.ReadErrorsTotal; WriteErr = $c.WriteErrorsTotal
    ReadUnc = $c.ReadErrorsUncorrected; WriteUnc = $c.WriteErrorsUncorrected
  }
})
$uninst = @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*')
$r.software = @(Get-ItemProperty $uninst | Where-Object { $_.DisplayName -match 'Chipset|NVIDIA Graphics Driver|AMD Software|Radeon Software|Intel.*(Graphics|Management Engine)' } | Select-Object DisplayName,DisplayVersion)
$r | ConvertTo-Json -Depth 5 -Compress
`;

// Frecuencia en vivo: clase WMI de rendimiento (nombre en inglés en todos los idiomas).
// Frecuencia efectiva = frecuencia nominal * % rendimiento / 100 (lo mismo que ve el Administrador de tareas).
const LIVE_CPU_SCRIPT = String.raw`
while ($true) {
  $rows = @(Get-CimInstance Win32_PerfFormattedData_Counters_ProcessorInformation | Select-Object Name,ProcessorFrequency,PercentProcessorPerformance,PercentProcessorUtility,PercentProcessorTime)
  [Console]::Out.WriteLine((@{ t = $rows } | ConvertTo-Json -Compress -Depth 3))
  Start-Sleep -Milliseconds 800
}
`;

// ---------------------------------------------------------------------------
// Normalización (funciones puras: se testean con fixtures, sin Windows)
// ---------------------------------------------------------------------------

const VIRTUAL_GPU_RE = /virtual|basic display|basic render|remote|parsec|\bidd\b|displaylink|meta |hyper-v/i;

function normalizeGpus(raw) {
  const mem = asArray(raw.gpuMem);
  let list = asArray(raw.gpu).filter((g) => clean(g.Name) && !VIRTUAL_GPU_RE.test(g.Name));
  if (!list.length) list = asArray(raw.gpu).filter((g) => clean(g.Name));
  return list.map((g) => {
    const name = clean(g.Name);
    const vendor = /nvidia/i.test(name) ? 'NVIDIA' : /amd|radeon|advanced micro/i.test(name + g.AdapterCompatibility) ? 'AMD'
      : /intel/i.test(name + g.AdapterCompatibility) ? 'Intel' : clean(g.AdapterCompatibility);
    // AdapterRAM es de 32 bits y se queda en 4 GB: se prefiere el valor del registro (64 bits).
    const regMem = mem.find((m) => clean(m.DriverDesc) === name);
    const regBytes = num(regMem && regMem.Mem);
    const ramBytes = num(g.AdapterRAM);
    const vramMB = regBytes ? Math.round(regBytes / 1048576)
      : ramBytes && ramBytes < 4290000000 ? Math.round(ramBytes / 1048576) : null;
    return {
      name,
      vendor,
      vramMB,
      vramApprox: !regBytes && !(ramBytes && ramBytes < 4290000000),
      driverVersionRaw: clean(g.DriverVersion),
      driverVersion: vendor === 'NVIDIA' ? nvidiaUserVersion(g.DriverVersion) : clean(g.DriverVersion) || null,
      driverDate: toIsoDate(g.DriverDate),
    };
  });
}

function normalizeRam(raw) {
  const modules = asArray(raw.ram).map((m) => {
    const rated = num(m.Speed);
    const mv = num(m.ConfiguredVoltage);
    return {
      slot: clean(m.DeviceLocator) || clean(m.BankLabel),
      manufacturer: memoryVendor(m.Manufacturer),
      partNumber: clean(m.PartNumber),
      capacityMB: Math.round((num(m.Capacity) || 0) / 1048576),
      type: MEMORY_TYPES[num(m.SMBIOSMemoryType)] || MEMORY_TYPES[num(m.MemoryType)] || null,
      ratedMHz: rated,
      configuredMHz: num(m.ConfiguredClockSpeed) || rated,
      voltageV: mv ? mv / 1000 : null,
    };
  });
  const arr = asArray(raw.ramSlots)[0] || {};
  return {
    totalMB: modules.reduce((s, m) => s + m.capacityMB, 0),
    slotsTotal: num(arr.MemoryDevices),
    modules,
  };
}

function diskType(d) {
  const bus = clean(d.BusType).toLowerCase();
  const media = clean(d.MediaType).toLowerCase();
  if (bus === 'nvme') return 'NVMe';
  if (media === 'ssd') return 'SSD';
  if (media === 'hdd') return 'HDD';
  if (bus === 'usb') return 'USB';
  return 'Disco';
}

function normalizeDisks(raw) {
  return asArray(raw.disks).map((d) => {
    const unc = [num(d.ReadUnc), num(d.WriteUnc)].filter((v) => v != null);
    return {
    id: clean(d.Id),
    name: clean(d.Name),
    type: diskType(d),
    bus: clean(d.BusType),
    sizeGB: Math.round((num(d.Size) || 0) / 1e9),
    smart: {
      status: clean(d.Health) || null, // Healthy | Warning | Unhealthy
      operational: clean(d.Operational) || null,
      wearPct: num(d.Wear),
      tempC: num(d.Temp),
      powerOnHours: num(d.Hours),
      readErrors: num(d.ReadErr),
      writeErrors: num(d.WriteErr),
      uncorrectedErrors: unc.length ? unc.reduce((a, b) => a + b, 0) : null,
    },
    };
  });
}

function normalizeWindows(raw) {
  const c = asArray(raw.cpu)[0] || {};
  const rawName = clean(c.Name);
  const vendor = /intel/i.test(clean(c.Manufacturer) + rawName) ? 'Intel'
    : /amd|authenticamd/i.test(clean(c.Manufacturer) + rawName) ? 'AMD' : clean(c.Manufacturer);
  const software = asArray(raw.software).map((s) => ({ name: clean(s.DisplayName), version: clean(s.DisplayVersion) }));
  const chipsetSw = software.find((s) => /chipset/i.test(s.name));

  const b = asArray(raw.board)[0] || {};
  const bios = asArray(raw.bios)[0] || {};
  const os = asArray(raw.os)[0] || {};
  const m = asArray(raw.machine)[0] || {};

  return {
    meta: { source: 'windows', collectedAt: Date.now(), warnings: [] },
    machine: { name: clean(m.Name), manufacturer: clean(m.Manufacturer), model: clean(m.Model) },
    os: { caption: clean(os.Caption), version: clean(os.Version), build: clean(os.BuildNumber), arch: clean(os.OSArchitecture) },
    cpu: {
      vendor,
      rawName,
      name: cleanCpuName(rawName),
      cores: num(c.NumberOfCores),
      threads: num(c.NumberOfLogicalProcessors),
      reportedBaseMHz: num(c.MaxClockSpeed),
      l2KB: num(c.L2CacheSize),
      l3KB: num(c.L3CacheSize),
      socket: clean(c.SocketDesignation) || null,
      sockets: asArray(raw.cpu).length,
      chipsetDriver: chipsetSw ? { name: chipsetSw.name, version: chipsetSw.version } : null,
    },
    gpus: normalizeGpus(raw),
    memory: normalizeRam(raw),
    board: {
      manufacturer: shortBoardVendor(b.Manufacturer),
      model: clean(b.Product),
      version: clean(b.Version),
      chipset: chipsetFromBoard(b.Product),
      bios: { vendor: clean(bios.Manufacturer), version: clean(bios.SMBIOSBIOSVersion), date: toIsoDate(bios.ReleaseDate) },
    },
    disks: normalizeDisks(raw),
    software,
  };
}

// Una línea del stream en vivo → datos de CPU.
const effMHz = (r) => {
  const f = num(r.ProcessorFrequency);
  const p = num(r.PercentProcessorPerformance);
  return f && p != null ? Math.round((f * p) / 100) : f;
};

function parseCpuLive(obj) {
  const rows = asArray(obj && obj.t);
  const total = rows.find((r) => r.Name === '_Total');
  const perCore = rows
    .filter((r) => /^\d+,\d+$/.test(r.Name))
    .map((r) => ({
      id: r.Name,
      mhz: effMHz(r),
      loadPct: clamp(num(r.PercentProcessorUtility) ?? num(r.PercentProcessorTime) ?? 0, 0, 100),
    }));
  if (!total && !perCore.length) return null;
  const mhzList = perCore.map((c) => c.mhz).filter((v) => v != null);
  return {
    effectiveMHz: total ? effMHz(total) : mhzList.length ? Math.round(mhzList.reduce((a, b) => a + b, 0) / mhzList.length) : null,
    maxCoreMHz: mhzList.length ? Math.max(...mhzList) : total ? effMHz(total) : null,
    nominalMHz: total ? num(total.ProcessorFrequency) : null,
    loadPct: total ? clamp(num(total.PercentProcessorUtility) ?? num(total.PercentProcessorTime) ?? 0, 0, 100) : null,
    perCore,
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function collect() {
  const raw = await runJson(STATIC_SCRIPT);
  return normalizeWindows(raw);
}

// Devuelve { stop }. onCpu recibe cada muestra; onFail se llama si PowerShell se cae.
function streamCpu(onCpu, onFail) {
  const stop = streamLines(
    LIVE_CPU_SCRIPT,
    (line) => {
      try {
        const parsed = parseCpuLive(JSON.parse(line));
        if (parsed) onCpu(parsed);
      } catch { /* línea corrupta: se ignora */ }
    },
    (code) => onFail && onFail(code)
  );
  return { stop };
}

module.exports = { collect, streamCpu, normalizeWindows, parseCpuLive, STATIC_SCRIPT, LIVE_CPU_SCRIPT };
