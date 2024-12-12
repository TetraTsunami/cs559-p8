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
varying vec3 fNormal;
varying vec2 fTexCoord;
uniform sampler2D texSampler1;
uniform mat4 uMV;
uniform mat3 uMVn;

const vec3  lightV    = vec3(0.0,0,1.0);
const float lightI    = 1.0; 
const float ambientC  = 0.5;
const float diffuseC  = 0.4;
const float specularC = 0.3;
const float specularE = 32.0;
const vec3  lightCol  = vec3(1.0,1.0,1.0);
const vec3  objectCol = vec3(1.0,0.6,0.0); // yellow-ish orange
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
	vec3 texColor=texture2D(texSampler1,fTexCoord).xyz;
	float alpha = texture2D(texSampler1, fTexCoord).a;
	vec3 n = normalize(uMVn * fNormal);
	vec3 ColorS  = blinnPhongDir(lightV,n,0.0,0.0,0.0,specularC,specularE).y*lightCol*texColor;
	vec3 ColorAD = blinnPhongDir(lightV,n,lightI,ambientC,diffuseC,0.0,1.0).x*texColor;
	gl_FragColor = vec4(ColorAD+ColorS,alpha);
}
`;
