/* globals mat3, mat4, WebGLDebugUtils */
import loadOBJ from "./parse-obj.js";
/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("canvas");
/** @type {WebGLRenderingContext} */
const gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl"));

function compileShaders(vertexSource, fragmentSource) {
  // Compile vertex shader
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexSource);
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(vertexShader));
    return null;
  }
  // Compile fragment shader
  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentSource);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(fragmentShader));
    return null;
  }
  // Attach the shaders and link
  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Could not initialize shaders");
  }
  // Attributes and uniforms
  shaderProgram.PositionAttribute = gl.getAttribLocation(
    shaderProgram,
    "vPosition"
  );
  if (shaderProgram.PositionAttribute != -1) {
    gl.enableVertexAttribArray(shaderProgram.PositionAttribute);
  }
  shaderProgram.NormalAttribute = gl.getAttribLocation(
    shaderProgram,
    "vNormal"
  );
  if (shaderProgram.NormalAttribute != -1) {
    gl.enableVertexAttribArray(shaderProgram.NormalAttribute);
  }
  shaderProgram.texcoordAttribute = gl.getAttribLocation(
    shaderProgram,
    "vTexCoord"
  );
  if (shaderProgram.texcoordAttribute != -1) {
    gl.enableVertexAttribArray(shaderProgram.texcoordAttribute);
  }
  // gl.enableVertexAttribArray(shaderProgram.ColorAttribute);
  // matrix uniform
  shaderProgram.MVmatrix = gl.getUniformLocation(shaderProgram, "uMV");
  shaderProgram.MVNormalmatrix = gl.getUniformLocation(shaderProgram, "uMVn");
  shaderProgram.MVPmatrix = gl.getUniformLocation(shaderProgram, "uMVP");
  shaderProgram.Time = gl.getUniformLocation(shaderProgram, "uTime");
  return shaderProgram;
}

function createBuffer(
  data,
  itemSize = 3,
  bufferType = gl.ARRAY_BUFFER,
  bufferUsage = gl.STATIC_DRAW
) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(bufferType, buffer);
  gl.bufferData(bufferType, data, bufferUsage);
  buffer.itemSize = itemSize;
  buffer.numItems = data.length;
  buffer.prettyLog = function () {
    const group = [];
    for (let i = 0; i < data.length; i += itemSize) {
      group.push(data.slice(i, i + itemSize).toString());
    }
    console.log(group);
  };
  return buffer;
}

export default class Model {
  constructor(def) {
    this.def = {
      objURL: "",
      texURLs: [],
      vertexShaderSrc: "",
      fragmentShaderSrc: "",
      position: [0,0,0],
      rotation: [0,0,0],
      scale: [1,1,1],
      ...def,
    }
    this.textureData = [];
    this.shaderProgram = null;
    this.positionBuffer = null;
    this.normalBuffer = null;
    this.textureBuffer = null;
    this.indexBuffer = null;
    this.transform = mat4.create();
  }

  async load() {
    // Compile shaders
    this.shaderProgram = compileShaders(
      this.def.vertexShaderSrc,
      this.def.fragmentShaderSrc
    );
    gl.useProgram(this.shaderProgram);
    // Import model data
    const modelData = await loadOBJ(this.def.objURL);
    this.positionBuffer = createBuffer(modelData.positions);
    this.textureBuffer = createBuffer(modelData.textureCoords, 2);
    this.normalBuffer = createBuffer(modelData.normals);
    this.indexBuffer = createBuffer(
      modelData.indices,
      1,
      gl.ELEMENT_ARRAY_BUFFER
    );
    // Set up the transformation matrix
    mat4.identity(this.transform);
    mat4.translate(this.transform, this.transform, this.def.position);
    mat4.rotateX(this.transform, this.transform,
      this.def.rotation[0]
    )
    mat4.rotateY(this.transform, this.transform,
      this.def.rotation[1]
    )
    mat4.rotateZ(this.transform, this.transform,
      this.def.rotation[2]
    )
    mat4.scale(this.transform, this.transform, this.def.scale);
    // Download + attach texture data
    this.texturesLoaded = 0;
    this.shaderProgram.texSamplers = [];
    // for each texture...
    this.def.texURLs.forEach((texURL, i) => {
      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // Initially set to null
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
      const image = new Image();
      image.onload = () => {
        gl.useProgram(this.shaderProgram);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // once image is loaded, set texture to image
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          image
        );
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          gl.LINEAR_MIPMAP_LINEAR
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        const samplerUniform = gl.getUniformLocation(
          this.shaderProgram,
          `texSampler${i + 1}`
        );
        gl.uniform1i(samplerUniform, i);
        this.shaderProgram.texSamplers.push(samplerUniform);
        this.texturesLoaded++;
      };
      image.crossOrigin = "anonymous";
      image.src = texURL;
      this.textureData.push(texture);
    });
  }

  draw(viewMatrix, projectionMatrix, time, transform = null) {
    gl.useProgram(this.shaderProgram);
    const mvMatrix = mat4.create();
    const mvNormalMatrix = mat3.create();
    const mvpMatrix = mat4.create();
    mat4.copy(mvMatrix, this.transform);
    if (transform !== null) {
      mat4.multiply(mvMatrix, mvMatrix, transform);
    }
    mat4.multiply(mvMatrix, viewMatrix, mvMatrix);
    mat3.normalFromMat4(mvNormalMatrix, mvMatrix);
    mat4.multiply(mvpMatrix, projectionMatrix, mvMatrix);

    // Set uniforms
    gl.uniformMatrix4fv(this.shaderProgram.MVmatrix, false, mvMatrix);
    gl.uniformMatrix3fv(
      this.shaderProgram.MVNormalmatrix,
      false,
      mvNormalMatrix
    );
    gl.uniformMatrix4fv(this.shaderProgram.MVPmatrix, false, mvpMatrix);
    // Set time uniform if it exists
    if (this.shaderProgram.Time !== null && this.shaderProgram.Time !== -1) {
      gl.uniform1f(this.shaderProgram.Time, time);
    }
    // Bind buffers and attributes
    // Position buffer
    if (this.shaderProgram.PositionAttribute != -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.vertexAttribPointer(
        this.shaderProgram.PositionAttribute,
        this.positionBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
      );
    }
    // Normal buffer
    if (this.shaderProgram.NormalAttribute != -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
      gl.vertexAttribPointer(
        this.shaderProgram.NormalAttribute,
        this.normalBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
      );
    }
    if (this.shaderProgram.texcoordAttribute != -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);
      gl.vertexAttribPointer(
        this.shaderProgram.texcoordAttribute,
        this.textureBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
      );
      // Bind textures
      for (let i = 0; i < this.textureData.length; i++) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, this.textureData[i]);
      }
    }
    // Index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElements(
      gl.TRIANGLES,
      this.indexBuffer.numItems,
      gl.UNSIGNED_SHORT,
      0
    );
  }
}
