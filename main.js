/* globals mat4, WebGLDebugUtils */
// https://stackoverflow.com/questions/58225496/best-way-to-load-non-js-scripts-from-an-assets-folder-getelementbyid-vs-fetch
import { vertexSource as vs, fragmentSource as fs } from "./shader.glsl.js";
import { vertexSource as cvs, fragmentSource as cfs } from "./caustic.glsl.js";
import Model from "./model.js";
/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("canvas");
/** @type {WebGLRenderingContext} */
const gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl"));
/** @type {HTMLInputElement} */
const slider1 = document.getElementById("rot");
/** @type {HTMLInputElement} */
const slider2 = document.getElementById("dist");
/** @type {HTMLInputElement} */
const sliderFish = document.getElementById("fish");

/** @type Model[] */
const models = [];
const modelDefinitions = [
  {
    objURL: "./goldfish.obj",
    texURLs: ["./tex_goldfish.png"],
    vertexShaderSrc: vs,
    fragmentShaderSrc: fs,
    scale: [1, 1, 1],
  },
  {
    objURL: "./face.obj",
    vertexShaderSrc: cvs,
    fragmentShaderSrc: cfs,
    position: [0, -100, 0],
  },
];

async function start() {
  // Load the models!
  for (const def of modelDefinitions) {
    const model = new Model(def);
    await model.load();
    models.push(model);
  }

  function draw() {
    // animation/user variables
    const angle1 = slider1.value * 0.02 * Math.PI;
    const angle2 = sliderFish.value * 0.01;
    const dist = slider2.value * 0.02;
    const time = performance.now() * 0.001;
    // get fish rotation
    const fishRotation = parseFloat(sliderFish.value) * (Math.PI / 180);
    // camera position
    const eye = [400 * Math.sin(angle1), 150.0*angle2, 400.0 * Math.cos(angle1)];
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    // Update camera matrices
    const tCamera = mat4.create();
    mat4.lookAt(tCamera, eye, target, up);

    const tProjection = mat4.create();
    mat4.perspective(tProjection, (dist * Math.PI) / 4, 1, 10, 5000);

    // Clear screen, prepare for rendering
    gl.clearColor(0.0, 0.2, 0.6, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Draw each model
    for (const model of models) {
      if (model.texturesLoaded != model.def.texURLs.length) {
        console.log("Model", model.objUrl, "isn't finished loading")
        continue;
      }
      if (model.objUrl === "./fissh.obj") {
        const fishTransform = mat4.create();
        mat4.rotateY(fishTransform, fishTransform, fishRotation);
        model.draw(tCamera, tProjection, time, fishTransform);
      } else {
        model.draw(tCamera, tProjection, time);
      }
    }
  }
  function update() {
    draw();
    requestAnimationFrame(update);
  }
  setTimeout(update, 200);
}

window.onload = start;
