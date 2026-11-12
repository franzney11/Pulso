// Orden del menú. `group` separa el menú en tres bloques: resumen, componentes y herramientas.
import resumen from './resumen.js';
import cpu from './cpu.js';
import gpu from './gpu.js';
import memoria from './memoria.js';
import discos from './discos.js';
import placa from './placa.js';
import sensores from './sensores.js';
import drivers from './drivers.js';
import overclock from './overclock.js';
import equipo from './equipo.js';

export const VIEWS = [resumen, cpu, gpu, memoria, discos, placa, sensores, drivers, overclock, equipo];
