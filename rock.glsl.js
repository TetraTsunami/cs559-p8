/* -------------------------------------------------------------------------- */
/*                                Vertex Shader                               */
/* -------------------------------------------------------------------------- */
export const vertexSource = /* glsl */ `
attribute vec3 vPosition;
attribute vec3 vNormal;
attribute vec2 vTexCoord;
varying vec3 fPosition;
varying vec3 fNormal;
varying vec2 fTexCoord;
uniform mat4 uMV;
uniform mat4 uMVP;

void main(void) {
	gl_Position = uMVP * vec4(vPosition, 1.0);
	fPosition = (uMV * vec4(vPosition, 1.0)).xyz;
	fNormal = vNormal;
	fTexCoord = vTexCoord;
}
`;

/* -------------------------------------------------------------------------- */
/*                              Fragment Shader                               */
/* -------------------------------------------------------------------------- */
export const fragmentSource = /* glsl */ `
precision highp float;
varying vec3 fPosition;
uniform float uTime;
varying vec3 fNormal;
varying vec2 fTexCoord;
uniform sampler2D texSampler1;
uniform mat4 uMV;
uniform mat3 uMVn;

//
// psrddnoise2.glsl
//
// Authors: Stefan Gustavson (stefan.gustavson@gmail.com)
// and Ian McEwan (ijm567@gmail.com)
// Version 2021-12-02, published under the MIT license (see below)
//
// Copyright (c) 2021 Stefan Gustavson and Ian McEwan.
//
float psrddnoise(vec2 x, vec2 period, float alpha, out vec2 gradient, out vec3 dg) {

	// Transform to simplex space (axis-aligned hexagonal grid)
	vec2 uv = vec2(x.x + x.y*0.5, x.y);

	// Determine which simplex we're in, with i0 being the "base"
	vec2 i0 = floor(uv);
	vec2 f0 = fract(uv);
	// o1 is the offset in simplex space to the second corner
	float cmp = step(f0.y, f0.x);
	vec2 o1 = vec2(cmp, 1.0-cmp);

	// Enumerate the remaining simplex corners
	vec2 i1 = i0 + o1;
	vec2 i2 = i0 + vec2(1.0, 1.0);

	// Transform corners back to texture space
	vec2 v0 = vec2(i0.x - i0.y * 0.5, i0.y);
	vec2 v1 = vec2(v0.x + o1.x - o1.y * 0.5, v0.y + o1.y);
	vec2 v2 = vec2(v0.x + 0.5, v0.y + 1.0);

	// Compute vectors from v to each of the simplex corners
	vec2 x0 = x - v0;
	vec2 x1 = x - v1;
	vec2 x2 = x - v2;

	vec3 iu, iv;
	vec3 xw, yw;

	// Wrap to periods, if desired
	if(any(greaterThan(period, vec2(0.0)))) {
	xw = vec3(v0.x, v1.x, v2.x);
	yw = vec3(v0.y, v1.y, v2.y);
	if(period.x > 0.0)
	xw = mod(vec3(v0.x, v1.x, v2.x), period.x);
	if(period.y > 0.0)
	yw = mod(vec3(v0.y, v1.y, v2.y), period.y);
	// Transform back to simplex space and fix rounding errors
	iu = floor(xw + 0.5*yw + 0.5);
	iv = floor(yw + 0.5);
	} else { // Shortcut if neither x nor y periods are specified
	iu = vec3(i0.x, i1.x, i2.x);
	iv = vec3(i0.y, i1.y, i2.y);
	}

	// Compute one pseudo-random hash value for each corner
	vec3 hash = mod(iu, 289.0);
	hash = mod((hash*51.0 + 2.0)*hash + iv, 289.0);
	hash = mod((hash*34.0 + 10.0)*hash, 289.0);

	// Pick a pseudo-random angle and add the desired rotation
	vec3 psi = hash * 0.07482 + alpha;
	vec3 gx = cos(psi);
	vec3 gy = sin(psi);

	// Reorganize for dot products below
	vec2 g0 = vec2(gx.x,gy.x);
	vec2 g1 = vec2(gx.y,gy.y);
	vec2 g2 = vec2(gx.z,gy.z);

	// Radial decay with distance from each simplex corner
	vec3 w = 0.8 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2));
	w = max(w, 0.0);
	vec3 w2 = w * w;
	vec3 w4 = w2 * w2;

	// The value of the linear ramp from each of the corners
	vec3 gdotx = vec3(dot(g0, x0), dot(g1, x1), dot(g2, x2));

	// Multiply by the radial decay and sum up the noise value
	float n = dot(w4, gdotx);

	// Compute the first order partial derivatives
	vec3 w3 = w2 * w;
	vec3 dw = -8.0 * w3 * gdotx;
	vec2 dn0 = w4.x * g0 + dw.x * x0;
	vec2 dn1 = w4.y * g1 + dw.y * x1;
	vec2 dn2 = w4.z * g2 + dw.z * x2;
	gradient = 10.9 * (dn0 + dn1 + dn2);

	// Compute the second order partial derivatives
	vec3 dg0, dg1, dg2;
	vec3 dw2 = 48.0 * w2 * gdotx;
	// d2n/dx2 and d2n/dy2
	dg0.xy = dw2.x * x0 * x0 - 8.0 * w3.x * (2.0 * g0 * x0 + gdotx.x);
	dg1.xy = dw2.y * x1 * x1 - 8.0 * w3.y * (2.0 * g1 * x1 + gdotx.y);
	dg2.xy = dw2.z * x2 * x2 - 8.0 * w3.z * (2.0 * g2 * x2 + gdotx.z);
	// d2n/dxy
	dg0.z = dw2.x * x0.x * x0.y - 8.0 * w3.x * dot(g0, x0.yx);
	dg1.z = dw2.y * x1.x * x1.y - 8.0 * w3.y * dot(g1, x1.yx);
	dg2.z = dw2.z * x2.x * x2.y - 8.0 * w3.z * dot(g2, x2.yx);
	dg = 10.9 * (dg0 + dg1 + dg2);

	// Scale the return value to fit nicely into the range [-1,1]
	return 10.9 * n;
}

float lines(float x) {
	// very high values if x is around 0.5 else very low values
	// roughly bell curve formula if you squint really hard
	return pow(2.0, -1000.0 * pow((0.5 - x), 2.0));
}

vec2 blinnPhongDir(vec3 lightDir, vec3 n, float lightInt, float Ka,
	float Kd, float Ks, float shininess) {
	vec3 s = normalize(lightDir);
	vec3 v = normalize(-fPosition);
	vec3 h = normalize(v+s);
	float diffuse = Ka + Kd * lightInt * max(0.0, dot(n, s));
	float spec =  Ks * pow(max(0.0, dot(n,h)), shininess);
	return vec2(diffuse, spec);
}

void main(void) {
	vec2 x = fPosition.xz / 300.0;
	vec2 period = vec2(0.0, 0.0);
	vec2 gradient;
	vec3 dg;
	
	// Use noise to create caustic patterns
	float fbm = 0.0;
	float frequency = 1.0;
	float amplitude = 0.5;
	const int OCTAVES = 3;
	for(int i = 0; i < OCTAVES; i++) {
		fbm += psrddnoise(x * frequency, period, uTime, gradient, dg) * amplitude;
		frequency *= 2.0;
		amplitude *= 0.5;
	}
	float intensity1 = lines(smoothstep(-1.0, 1.0, fbm));
	x = fPosition.xz / 100.0 + vec2(10.0, 20.0);
	fbm = 0.0;
	frequency = 1.0;
	amplitude = 0.5;
	for(int i = 0; i < OCTAVES; i++) {
		fbm += psrddnoise(x * frequency, period, uTime, gradient, dg) * amplitude;
		frequency *= 2.0;
		amplitude *= 0.5;
	}
	float intensity2 = lines(smoothstep(-1.0, 1.0, fbm));
	vec3 causticColor = vec3(0.1, 0.3, 0.6) * intensity1 + vec3(0.0, 0.1, 0.5) * intensity2;
	vec3 n = normalize(uMVn * fNormal);
	vec3 texColor=texture2D(texSampler1,fTexCoord).xyz;
	vec3 ColorAD = blinnPhongDir(vec3(0.0,1.0,0.0),n,0.5,0.4,0.4,0.0,1.0).x*texColor;
	gl_FragColor = vec4(vec3(0.0, 0.2, 0.6) + causticColor * 0.4 + ColorAD * 0.6, 1.0);
}
`;
