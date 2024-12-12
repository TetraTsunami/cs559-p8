/* globals mat4, */
// https://stackoverflow.com/questions/58225496/best-way-to-load-non-js-scripts-from-an-assets-folder-getelementbyid-vs-fetch
import { vertexSource as vs, fragmentSource as fs } from "./shader.glsl.js";
import { vertexSource as cvs, fragmentSource as cfs } from "./caustic.glsl.js";
import { vertexSource as rvs, fragmentSource as rfs } from "./rock.glsl.js";
import BoidsController from "./BoidsController.js";
import Entity from "./Entity.js";
import Model from "./model.js";
/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("canvas");
/** @type {WebGLRenderingContext} */
const gl = canvas.getContext("webgl");
/** @type {HTMLInputElement} */
const slider1 = document.getElementById("rot");
/** @type {HTMLInputElement} */
const slider2 = document.getElementById("dist");
/** @type {HTMLInputElement} */
const sliderFish = document.getElementById("fish");
/** @type {HTMLInputElement} */
const speed = document.getElementById("speed");

/** @type Model[] */
const models = [];
const modelDefinitions = [
  {
    objURL: "./goldfish.obj",
    texURLs: ["./goldfish.png"],
    vertexShaderSrc: vs,
    fragmentShaderSrc: fs,
    scale: [0.25, 0.25, 0.25],
  },
  {
    objURL: "./face.obj",
    vertexShaderSrc: cvs,
    fragmentShaderSrc: cfs,
    position: [0, -100, 0],
  },
  {
    objURL: "./rock.obj",
    texURLs: ["./rock.jpg"],
    vertexShaderSrc: rvs,
    fragmentShaderSrc: rfs,
    position: [200, -100, 50],
    scale: [50, 50, 50],
    rotation: [Math.PI, 0, 0],
  },
  {
    objURL: "./rock.obj",
    texURLs: ["./rock.jpg"],
    vertexShaderSrc: rvs,
    fragmentShaderSrc: rfs,
    position: [-20, -120, -140],
    scale: [50, 50, 100],
    rotation: [Math.PI, 2, 0],
  },
  {
    objURL: "./rock.obj",
    texURLs: ["./rock.jpg"],
    vertexShaderSrc: rvs,
    fragmentShaderSrc: rfs,
    position: [-150, -100, 140],
    scale: [50, 50, 50],
    rotation: [Math.PI, 2, 0],
  },
];
const boidsController = new BoidsController(2000, 600, 2000, 10);
boidsController.maxEntitySpeed = 1;
const boidsCenter = [1000, 300, 1000];
async function start() {
  // Load the models!
  for (const def of modelDefinitions) {
    const model = new Model(def);
    await model.load();
    models.push(model);
  }

  // Set up the BOIDS
  const boundary = boidsController.getBoundary();
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(Math.random() * boundary[0]);
    const y = Math.floor(Math.random() * boundary[1]);
    const z = Math.floor(Math.random() * boundary[2]);
    const vx = Math.random() * 4 - 2;
    const vy = Math.random() * 4 - 2;
    const vz = Math.random() * 4 - 2;

    const entity = new Entity(Entity.FLOCK_ENTITY, x, y, z, vx, vy, vz);
    boidsController.addFlockEntity(entity);
  }

  function draw() {
    // animation/user variables
    const angle1 = slider1.value * 0.02 * Math.PI;
    const angle2 = sliderFish.value * 0.01;
    const dist = slider2.value * 0.02;
    const time = performance.now() * 0.001;
    boidsController.maxEntitySpeed = speed.value * 0.02;
    canvas.width = window.innerWidth;
    gl.viewport(0, 0, canvas.width, canvas.height);
    // camera position
    const eye = [
      400 * Math.sin(angle1),
      150.0 * angle2,
      400.0 * Math.cos(angle1),
    ];
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    // Update camera matrices
    const tCamera = mat4.create();
    mat4.lookAt(tCamera, eye, target, up);

    const tProjection = mat4.create();
    const aspect = canvas.width / canvas.height;
    mat4.perspective(tProjection, (dist * Math.PI) / 4, aspect, 10, 5000);

    // Clear screen, prepare for rendering
    gl.clearColor(0.0, 0.2, 0.6, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Draw seafloor and other models
    for (let i = 1; i < models.length; i++) {
      models[i].draw(tCamera, tProjection, time);
    }

    // Render the fish boids
    const entities = boidsController.getFlockEntities();
    for (const entity of entities) {
      const tModel = mat4.create();
      const x = entity.x - boidsCenter[0];
      const y = entity.y - boidsCenter[1];
      const z = entity.z - boidsCenter[2];
      const data = entity.data || { x, y, z, vx: entity.vx, vy: entity.vy, vz: entity.vz };
      data.x = 0.9*data.x + 0.1*x;
      data.y = 0.9*data.y + 0.1*y;
      data.z = 0.9*data.z + 0.1*z;
      data.vx = 0.9*data.vx + 0.1*entity.vx;
      data.vy = 0.9*data.vy + 0.1*entity.vy;
      data.vz = 0.9*data.vz + 0.1*entity.vz;
      mat4.translate(tModel, tModel, [data.x,data.y,data.z]);
      mat4.targetTo(tModel, [data.x,data.y,data.z], 
        [data.x-data.vx, data.y-data.vy, data.z-data.vz], [0, 1, 0]);
      // Optionally, apply rotation based on entity.vx, entity.vy, entity.vz
      models[0].draw(tCamera, tProjection, time, tModel);
      entity.data = data;
    }
    boidsController.iterate();
  }

  function update() {
    draw();
    requestAnimationFrame(update);
  }
  setTimeout(update, 200);
}

window.onload = start;
