/**
 * Parses an OBJ file text and extracts vertex positions, texture coordinates, normals, and face indices.
 *
 * @param {string} text - The content of the OBJ file as a string.
 * @returns {Object} An object containing the parsed data:
 * @returns {Float32Array} positions - Array of vertex positions.
 * @returns {Float32Array} textureCoords - Array of texture coordinates.
 * @returns {Float32Array} normals - Array of vertex normals.
 * @returns {Uint16Array} indices - Array of face indices.
 */
function parseOBJ(text) {
  const positions = [];
  const textureCoords = [];
  const normals = [];
  const faces = [];
  const lines = text.split("\n");

  // FIRST! Parse the file, line by line
  for (const line of lines) {
    const parts = line.trim().split(" ");
    const type = parts[0];

    if (type === "v") {
      // Vertex position
      positions.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3])
      );
    } else if (type === "vt") {
      // Vertex texture coordinate
      textureCoords.push(
        parseFloat(parts[1]),
        1 - parseFloat(parts[2]),
      )
    } else if (type === "vn") {
      // Vertex normal
      normals.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3])
      );
    } else if (type === "f") {
      // Process face with arbitrary number of vertices
      const faceVertices = parts.slice(1).map((part) => {
        const [posIndex, texIndex, normIndex] = part
          .split("/")
          .map((idx) => parseInt(idx) - 1);
        return [posIndex, texIndex, normIndex];
      });
      // Quads fear me, I fear everything
      for (let i = 1; i < faceVertices.length - 1; i++) {
        faces.push(faceVertices[0], faceVertices[i], faceVertices[i + 1]);
      }
    }
  }
  // SECOND! Give each face its normals and texture coords.
  // program expects each vertex to have exactly one texture coord and one normal
  // but obj files can mix and match vertices and normals
  // compute set of unique vertex/normal pairs, and pass those to the program
  /** track unique vertex/texture/normal pairs
   * @type {Object.<string, number>}
   */
  const uniqueSet = {}; 
  /**  unique position/texture/normal triples */
  const uniqueVertices = [];
  /**  face -> index in uniqueVertices
   * @type {number[]}
  */
  const indices = [];
  for (let i = 0; i < faces.length; i++) {
    const [posIndex, texIndex, normIndex] = faces[i];
    const key = faces[i].toString();
    if (uniqueSet[key] === undefined) {
      uniqueSet[key] = uniqueVertices.length;
      indices.push(uniqueVertices.length);
      uniqueVertices.push([
        positions.slice(posIndex * 3, posIndex * 3 + 3),
        textureCoords.slice(texIndex * 2, texIndex * 2 + 2),
        normals.slice(normIndex * 3, normIndex * 3 + 3),
      ]);
    } else {
      indices.push(uniqueSet[key]);
    }
  }
  const [formattedVertices, formattedTexCoords, formattedNormals] = uniqueVertices.reduce(
    (acc, [vertex, tex, norm]) => {
      acc[0].push(...vertex);
      acc[1].push(...tex);
      acc[2].push(...norm);
      return acc;
    },
    [[], [], []]
  );
  // FINALLY! we can return things :)
  return {
    positions: new Float32Array(formattedVertices),
    textureCoords: new Float32Array(formattedTexCoords),
    normals: new Float32Array(formattedNormals),
    indices: new Uint16Array(indices),
  };
}

/**
 * Parses an OBJ file text and extracts vertex positions, texture coordinates, normals, and face indices.
 *
 * @param {string} url - Hawk tuah! link to that thang.
 * @returns {Object} An object containing the parsed data:
 * @returns {Float32Array} positions - Array of vertex positions.
 * @returns {Float32Array} textureCoords - Array of texture coordinates.
 * @returns {Float32Array} normals - Array of vertex normals.
 * @returns {Uint16Array} indices - Array of face indices.
 */
export default async function loadOBJ(url) {
  const response = await fetch(url);
  const text = await response.text();
  const parsed = parseOBJ(text);
  return parsed;
}
