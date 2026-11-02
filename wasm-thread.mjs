import {parentPort,workerData} from 'node:worker_threads';
import {executeWasm} from './wasm-grader.mjs';
parentPort.postMessage(await executeWasm(workerData.code));
