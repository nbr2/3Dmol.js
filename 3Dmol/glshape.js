/**
 * A GLShape is a collection of user specified shapes.
 * 
 * @constructor $3Dmol.GLShape
 * @extends {ShapeSpec}
 * @param {number} sid - Unique identifier
 * @param {ShapeSpec} stylespec - shape style specification
 */
$3Dmol.GLShape = (function() {

	// Marching cube, to match with protein surface generation
	var ISDONE = 2;

	/**
	 * 
	 * @param {$3Dmol.Geometry}
	 *            geo
	 * @param {$3Dmol.Color |
	 *            colorlike} color
	 */
	var updateColor = function(geo, color) {

		var C = color || $3Dmol.CC.color(color);
		geo.colorsNeedUpdate = true;

		for ( var g in geo.geometryGroups) {

			var geoGroup = geo.geometryGroups[g];
			var colorArr = geoGroup.colorArray;

			for (var i = 0, il = geoGroup.vertices; i < il; ++i) {
				colorArr[i * 3] = C.r;
				colorArr[i * 3 + 1] = C.g;
				colorArr[i * 3 + 2] = C.b;
			}
		}

	};


	/**
	 * @param {$3Dmol.GLShape}
	 *            shape
	 * @param {geometryGroup}
	 *            geoGroup
	 * @param {ArrowSpec}
	 *            spec
	 */
	var drawArrow = function(shape, geoGroup, spec) {

		var from = spec.start, end = spec.end, radius = spec.radius, radiusRatio = spec.radiusRatio, mid = spec.mid;

		if (!(from && end))
			return;

		// vertices

		var dir = end.clone();
		dir.sub(from).multiplyScalar(mid);
		var to = from.clone().add(dir);
		var negDir = dir.clone().negate();

		shape.intersectionShape.cylinder.push(new $3Dmol.Cylinder(from.clone(),
				to.clone(), radius));
		shape.intersectionShape.sphere.push(new $3Dmol.Sphere(from.clone(),
				radius));

		// get orthonormal vector
		var nvecs = [];
		nvecs[0] = dir.clone();
		if (Math.abs(nvecs[0].x) > 0.0001)
			nvecs[0].y += 1;
		else
			nvecs[0].x += 1;
		nvecs[0].cross(dir);
		nvecs[0].normalize();

		nvecs[0] = nvecs[0];
		// another orth vector
		nvecs[4] = nvecs[0].clone();
		nvecs[4].crossVectors(nvecs[0], dir);
		nvecs[4].normalize();
		nvecs[8] = nvecs[0].clone().negate();
		nvecs[12] = nvecs[4].clone().negate();

		// now quarter positions
		nvecs[2] = nvecs[0].clone().add(nvecs[4]).normalize();
		nvecs[6] = nvecs[4].clone().add(nvecs[8]).normalize();
		nvecs[10] = nvecs[8].clone().add(nvecs[12]).normalize();
		nvecs[14] = nvecs[12].clone().add(nvecs[0]).normalize();

		// eights
		nvecs[1] = nvecs[0].clone().add(nvecs[2]).normalize();
		nvecs[3] = nvecs[2].clone().add(nvecs[4]).normalize();
		nvecs[5] = nvecs[4].clone().add(nvecs[6]).normalize();
		nvecs[7] = nvecs[6].clone().add(nvecs[8]).normalize();
		nvecs[9] = nvecs[8].clone().add(nvecs[10]).normalize();
		nvecs[11] = nvecs[10].clone().add(nvecs[12]).normalize();
		nvecs[13] = nvecs[12].clone().add(nvecs[14]).normalize();
		nvecs[15] = nvecs[14].clone().add(nvecs[0]).normalize();

		// var start = geo.vertices.length;
		var start = geoGroup.vertices;
		var vertexArray = geoGroup.vertexArray;
		var colorArray = geoGroup.colorArray;
		var faceArray = geoGroup.faceArray;
		var normalArray = geoGroup.normalArray;
		var lineArray = geoGroup.lineArray;

		var offset, i, n;
		// add vertices, opposing vertices paired together
		for (i = 0, n = nvecs.length; i < n; ++i) {
			offset = 3 * (start + 3 * i);
			var bottom = nvecs[i].clone().multiplyScalar(radius).add(from);
			var top = nvecs[i].clone().multiplyScalar(radius).add(to);
			var conebase = nvecs[i].clone()
					.multiplyScalar(radius * radiusRatio).add(to);

			vertexArray[offset] = bottom.x;
			vertexArray[offset + 1] = bottom.y;
			vertexArray[offset + 2] = bottom.z;

			vertexArray[offset + 3] = top.x;
			vertexArray[offset + 4] = top.y;
			vertexArray[offset + 5] = top.z;

			vertexArray[offset + 6] = conebase.x;
			vertexArray[offset + 7] = conebase.y;
			vertexArray[offset + 8] = conebase.z;

			if (i > 0) {
				var prev_x = vertexArray[offset - 3];
				var prev_y = vertexArray[offset - 2];
				var prev_z = vertexArray[offset - 1];

				var c = new $3Dmol.Vector3(prev_x, prev_y, prev_z);
				var b = end.clone(), b2 = to.clone();
				var a = new $3Dmol.Vector3(conebase.x, conebase.y, conebase.z);

				shape.intersectionShape.triangle.push(new $3Dmol.Triangle(a, b,
						c));
				shape.intersectionShape.triangle.push(new $3Dmol.Triangle(c
						.clone(), b2, a.clone()));
			}
		}

		geoGroup.vertices += 48;
		offset = geoGroup.vertices * 3;

		// caps
		vertexArray[offset] = from.x;
		vertexArray[offset + 1] = from.y;
		vertexArray[offset + 2] = from.z;

		vertexArray[offset + 3] = to.x;
		vertexArray[offset + 4] = to.y;
		vertexArray[offset + 5] = to.z;

		vertexArray[offset + 6] = end.x;
		vertexArray[offset + 7] = end.y;
		vertexArray[offset + 8] = end.z;

		geoGroup.vertices += 3;

		// now faces
		var face, norm, faceoffset, lineoffset;
		var t1, t2, t2b, t3, t3b, t4, t1offset, t2offset, t2boffset, t3offset, t3boffset, t4offset;
		var n1, n2, n3, n4;
		var n_vertices = 0;
		var fromi = geoGroup.vertices - 3, toi = geoGroup.vertices - 2, endi = geoGroup.vertices - 1;
		var fromoffset = fromi * 3, tooffset = toi * 3, endoffset = endi * 3;
		for (i = 0, n = nvecs.length - 1; i < n; ++i) {

			var ti = start + 3 * i;
			offset = ti * 3;
			faceoffset = geoGroup.faceidx;
			lineoffset = geoGroup.lineidx;

			t1 = ti;
			t1offset = t1 * 3;
			t2 = ti + 1;
			t2offset = t2 * 3;
			t2b = ti + 2;
			t2boffset = t2b * 3;
			t3 = ti + 4;
			t3offset = t3 * 3;
			t3b = ti + 5;
			t3boffset = t3b * 3;
			t4 = ti + 3;
			t4offset = t4 * 3;

			// face = [t1, t2, t4], [t2, t3, t4];
			// face = [t1, t2, t3, t4];

			norm = [ nvecs[i], nvecs[i], nvecs[i + 1], nvecs[i + 1] ];

			n1 = n2 = nvecs[i];
			n3 = n4 = nvecs[i + 1];

			normalArray[t1offset] = n1.x;
			normalArray[t2offset] = n2.x;
			normalArray[t4offset] = n4.x;
			normalArray[t1offset + 1] = n1.y;
			normalArray[t2offset + 1] = n2.y;
			normalArray[t4offset + 1] = n4.y;
			normalArray[t1offset + 2] = n1.z;
			normalArray[t2offset + 2] = n2.z;
			normalArray[t4offset + 2] = n4.z;

			normalArray[t2offset] = n2.x;
			normalArray[t3offset] = n3.x;
			normalArray[t4offset] = n4.x;
			normalArray[t2offset + 1] = n2.y;
			normalArray[t3offset + 1] = n3.y;
			normalArray[t4offset + 1] = n4.y;
			normalArray[t2offset + 2] = n2.z;
			normalArray[t3offset + 2] = n3.z;
			normalArray[t4offset + 2] = n4.z;

			normalArray[t2boffset] = n2.x;
			normalArray[t3boffset] = n3.x;
			normalArray[t2boffset + 1] = n2.y;
			normalArray[t3boffset + 1] = n3.y;
			normalArray[t2boffset + 2] = n2.z;
			normalArray[t3boffset + 2] = n3.z;

			// sides
			faceArray[faceoffset] = t1;
			faceArray[faceoffset + 1] = t2;
			faceArray[faceoffset + 2] = t4;
			faceArray[faceoffset + 3] = t2;
			faceArray[faceoffset + 4] = t3;
			faceArray[faceoffset + 5] = t4;
			// caps
			faceArray[faceoffset + 6] = t1;
			faceArray[faceoffset + 7] = t4;
			faceArray[faceoffset + 8] = fromi;
			faceArray[faceoffset + 9] = t2b;
			faceArray[faceoffset + 10] = toi;
			faceArray[faceoffset + 11] = t3b;
			// arrowhead
			faceArray[faceoffset + 12] = t2b;
			faceArray[faceoffset + 13] = endi;
			faceArray[faceoffset + 14] = t3b;

			// sides
			lineArray[lineoffset] = t1;
			lineArray[lineoffset + 1] = t2;
			lineArray[lineoffset + 2] = t1;
			lineArray[lineoffset + 3] = t4;
			// lineArray[lineoffset+4] = t2, lineArray[lineoffset+5] = t3;
			lineArray[lineoffset + 4] = t3;
			lineArray[lineoffset + 5] = t4;
			// caps
			lineArray[lineoffset + 6] = t1;
			lineArray[lineoffset + 7] = t4;
			// lineArray[lineoffset+10] = t1, lineArray[lineoffset+11] = fromi;
			// lineArray[lineoffset+12] = t4, lineArray[lineoffset+13] = fromi;

			lineArray[lineoffset + 8] = t2b;
			lineArray[lineoffset + 9] = t2; // toi
			lineArray[lineoffset + 10] = t2b;
			lineArray[lineoffset + 11] = t3b;
			lineArray[lineoffset + 12] = t3;
			lineArray[lineoffset + 13] = t3b; // toi
			// arrowhead
			lineArray[lineoffset + 14] = t2b;
			lineArray[lineoffset + 15] = endi;
			lineArray[lineoffset + 16] = t2b;
			lineArray[lineoffset + 17] = t3b;
			lineArray[lineoffset + 18] = endi;
			lineArray[lineoffset + 19] = t3b;

			geoGroup.faceidx += 15;
			geoGroup.lineidx += 20;

		}
		// final face

		face = [ start + 45, start + 46, start + 1, start, start + 47,
				start + 2 ];
		norm = [ nvecs[15], nvecs[15], nvecs[0], nvecs[0] ];

		faceoffset = geoGroup.faceidx;
		lineoffset = geoGroup.lineidx;

		t1 = face[0];
		t1offset = t1 * 3;
		t2 = face[1];
		t2offset = t2 * 3;
		t2b = face[4];
		t2boffset = t2b * 3;
		t3 = face[2];
		t3offset = t3 * 3;
		t3b = face[5];
		t3boffset = t3b * 3;
		t4 = face[3];
		t4offset = t4 * 3;

		n1 = n2 = nvecs[15];
		n3 = n4 = nvecs[0];

		normalArray[t1offset] = n1.x;
		normalArray[t2offset] = n2.x;
		normalArray[t4offset] = n4.x;
		normalArray[t1offset + 1] = n1.y;
		normalArray[t2offset + 1] = n2.y;
		normalArray[t4offset + 1] = n4.y;
		normalArray[t1offset + 2] = n1.z;
		normalArray[t2offset + 2] = n2.z;
		normalArray[t4offset + 2] = n4.z;

		normalArray[t2offset] = n2.x;
		normalArray[t3offset] = n3.x;
		normalArray[t4offset] = n4.x;
		normalArray[t2offset + 1] = n2.y;
		normalArray[t3offset + 1] = n3.y;
		normalArray[t4offset + 1] = n4.y;
		normalArray[t2offset + 2] = n2.z;
		normalArray[t3offset + 2] = n3.z;
		normalArray[t4offset + 2] = n4.z;

		normalArray[t2boffset] = n2.x;
		normalArray[t3boffset] = n3.x;
		normalArray[t2boffset + 1] = n2.y;
		normalArray[t3boffset + 1] = n3.y;
		normalArray[t2boffset + 2] = n2.z;
		normalArray[t3boffset + 2] = n3.z;

		// Cap normals
		dir.normalize();
		negDir.normalize();
		normalArray[fromoffset] = negDir.x;
		normalArray[tooffset] = normalArray[endoffset] = dir.x;
		normalArray[fromoffset + 1] = negDir.y;
		normalArray[tooffset + 1] = normalArray[endoffset + 1] = dir.y;
		normalArray[fromoffset + 2] = negDir.z;
		normalArray[tooffset + 2] = normalArray[endoffset + 2] = dir.z;

		// Final side
		faceArray[faceoffset] = t1;
		faceArray[faceoffset + 1] = t2;
		faceArray[faceoffset + 2] = t4;
		faceArray[faceoffset + 3] = t2;
		faceArray[faceoffset + 4] = t3;
		faceArray[faceoffset + 5] = t4;
		// final caps
		faceArray[faceoffset + 6] = t1;
		faceArray[faceoffset + 7] = t4;
		faceArray[faceoffset + 8] = fromi;
		faceArray[faceoffset + 9] = t2b;
		faceArray[faceoffset + 10] = toi;
		faceArray[faceoffset + 11] = t3b;
		// final arrowhead
		faceArray[faceoffset + 12] = t2b;
		faceArray[faceoffset + 13] = endi;
		faceArray[faceoffset + 14] = t3b;

		// sides
		lineArray[lineoffset] = t1;
		lineArray[lineoffset + 1] = t2;
		lineArray[lineoffset + 2] = t1;
		lineArray[lineoffset + 3] = t4;
		// lineArray[lineoffset+4] = t2, lineArray[lineoffset+5] = t3;
		lineArray[lineoffset + 4] = t3;
		lineArray[lineoffset + 5] = t4;
		// caps
		lineArray[lineoffset + 6] = t1;
		lineArray[lineoffset + 7] = t4;
		// lineArray[lineoffset+10] = t1, lineArray[lineoffset+11] = fromi;
		// lineArray[lineoffset+12] = t4, lineArray[lineoffset+13] = fromi;

		lineArray[lineoffset + 8] = t2b;
		lineArray[lineoffset + 9] = t2; // toi
		lineArray[lineoffset + 10] = t2b;
		lineArray[lineoffset + 11] = t3b;
		lineArray[lineoffset + 12] = t3;
		lineArray[lineoffset + 13] = t3b; // toi
		// arrowhead
		lineArray[lineoffset + 14] = t2b;
		lineArray[lineoffset + 15] = endi;
		lineArray[lineoffset + 16] = t2b;
		lineArray[lineoffset + 17] = t3b;
		lineArray[lineoffset + 18] = endi;
		lineArray[lineoffset + 19] = t3b;

		geoGroup.faceidx += 15;
		geoGroup.lineidx += 20;

	};

	// handles custom shape generation from user supplied arrays
	// May need to generate normal and/or line indices
	/**
	 * @param {$3Dmol.GLShape}
	 *            shape
	 * @param {geometryGroup}
	 *            geoGroup
	 * @param {CustomSpec}
	 *            customSpec
	 */
	var drawCustom = function(shape, geoGroup, customSpec) {

		var vertexArr = customSpec.vertexArr, normalArr = customSpec.normalArr, faceArr = customSpec.faceArr, lineArr = customSpec.lineArr;

		if (vertexArr.length === 0 || faceArr.length === 0) {
			console
					.warn("Error adding custom shape component: No vertices and/or face indices supplied!");
		}

		geoGroup.vertices = vertexArr.length;
		geoGroup.faceidx = faceArr.length;

		var offset, v, a, b, c, i, il;

		for (i = 0, il = geoGroup.vertices; i < il; ++i) {
			offset = i * 3;
			v = vertexArr[i];
			geoGroup.vertexArray[offset] = v.x;
			geoGroup.vertexArray[offset + 1] = v.y;
			geoGroup.vertexArray[offset + 2] = v.z;
		}

		for (i = 0, il = geoGroup.faceidx / 3; i < il; ++i) {
			offset = i * 3;
			a = faceArr[offset];
			b = faceArr[offset + 1];
			c = faceArr[offset + 2];
			var vA = new $3Dmol.Vector3(), vB = new $3Dmol.Vector3(), vC = new $3Dmol.Vector3();
			shape.intersectionShape.triangle.push(new $3Dmol.Triangle(vA
					.copy(vertexArr[a]), vB.copy(vertexArr[b]), vC
					.copy(vertexArr[c])));
		}

		geoGroup.faceArray = new Uint16Array(faceArr);

		geoGroup.truncateArrayBuffers(true, true);

		if (normalArr.length < geoGroup.vertices)
			geoGroup.setNormals();
		else {

			geoGroup.normalArray = new Float32Array(geoGroup.vertices * 3);
			var n;
			for (i = 0, il = geoGroup.vertices; i < il; ++i) {
				offset = i * 3;
				n = normalArr[i];
				geoGroup.normalArray[offset] = n.x;
				geoGroup.normalArray[offset + 1] = n.y;
				geoGroup.normalArray[offset + 2] = n.z;
			}
		}

		if (!lineArr.length)
			geoGroup.setLineIndices();
		else
			geoGroup.lineArray = new Uint16Array(lineArr);

		geoGroup.lineidx = geoGroup.lineArray.length;

	};

	// Read a cube file - generate model and possibly shape(s)
	/**
	 * @param {$3Dmol.GLShape}
	 *            shape
	 * @param {geometryGroup}
	 *            geoGroup
	 * @param {string}
	 *            str
	 * @param {number}
	 *            isoval
	 * @param {boolean}
	 *            voxel
	 */
	var parseCube = function(shape, geoGroup, str, isoval, voxel) {

		var lines = str.replace(/^\s+/, "").split(/[\n\r]+/);

		if (lines.length < 6)
			return;

		var lineArr = lines[2].replace(/^\s+/, "").replace(/\s+/g, " ").split(
				" ");

		var natoms = Math.abs(parseFloat(lineArr[0]));
		var origin = new $3Dmol.Vector3(parseFloat(lineArr[1]),
				parseFloat(lineArr[2]), parseFloat(lineArr[3]));

		lineArr = lines[3].replace(/^\s+/, "").replace(/\s+/g, " ").split(" ");

		// might have to convert from bohr units to angstroms
		var convFactor = (parseFloat(lineArr[0]) > 0) ? 0.529177 : 1;

		origin.multiplyScalar(convFactor);

		var nX = Math.abs(lineArr[0]);
		var xVec = new $3Dmol.Vector3(parseFloat(lineArr[1]),
				parseFloat(lineArr[2]), parseFloat(lineArr[3]))
				.multiplyScalar(convFactor);

		lineArr = lines[4].replace(/^\s+/, "").replace(/\s+/g, " ").split(" ");

		var nY = Math.abs(lineArr[0]);
		var yVec = new $3Dmol.Vector3(parseFloat(lineArr[1]),
				parseFloat(lineArr[2]), parseFloat(lineArr[3]))
				.multiplyScalar(convFactor);

		lineArr = lines[5].replace(/^\s+/, "").replace(/\s+/g, " ").split(" ");

		var nZ = Math.abs(lineArr[0]);
		var zVec = new $3Dmol.Vector3(parseFloat(lineArr[1]),
				parseFloat(lineArr[2]), parseFloat(lineArr[3]))
				.multiplyScalar(convFactor);

		// lines.splice(6, natoms).join("\n");

		lines = new Float32Array(lines.splice(natoms + 7).join(" ").replace(
				/^\s+/, "").split(/[\s\r]+/));

		var vertnums = new Int16Array(nX * nY * nZ);

		var i, il;

		for (i = 0, il = vertnums.length; i < il; ++i)
			vertnums[i] = -1;

		var bitdata = new Uint8Array(nX * nY * nZ);

		for (i = 0, il = lines.length; i < il; ++i) {
			var val = (isoval >= 0) ? lines[i] - isoval : isoval - lines[i];

			if (val > 0)
				bitdata[i] |= ISDONE;

		}

		var verts = [], faces = [];

		$3Dmol.MarchingCube.march(bitdata, verts, faces, {
			fulltable : true,
			voxel : voxel,
			scale : xVec.length(),
			origin : origin,
			nX : nX,
			nY : nY,
			nZ : nZ
		});

		if (!voxel)
			$3Dmol.MarchingCube.laplacianSmooth(10, verts, faces);

		drawCustom(shape, geoGroup, {
			vertexArr : verts,
			faceArr : faces,
			normalArr : [],
			lineArr : []
		});

	};

	// Update a bounding sphere's position and radius
	// from list of centroids and new points
	/**
	 * @param {$3Dmol.Sphere}
	 *            sphere
	 * @param {Object}
	 *            components
	 * @param {Array}
	 *            points
	 */
	var updateBoundingFromPoints = function(sphere, components, points) {

		sphere.center.set(0, 0, 0);

		var i, il;

		if (components.length > 0) {

			for (i = 0, il = components.length; i < il; ++i) {
				var centroid = components[i].centroid;
				sphere.center.add(centroid);
			}

			sphere.center.divideScalar(components.length);
		}

		var maxRadiusSq = sphere.radius * sphere.radius;

		for (i = 0, il = points.length / 3; i < il; i++) {
			var x = points[i * 3], y = points[i * 3 + 1], z = points[i * 3 + 2];
			var radiusSq = sphere.center.distanceToSquared({
				x : x,
				y : y,
				z : z
			});
			maxRadiusSq = Math.max(maxRadiusSq, radiusSq);
		}

		sphere.radius = Math.sqrt(maxRadiusSq);

	};

	/**
	 * 
	 * @param {$3Dmol.GLShape}
	 *            shape
	 * @param {ShapeSpec}
	 *            stylespec
	 * @returns {undefined}
	 */
	var updateFromStyle = function(shape, stylespec) {
		shape.color = stylespec.color || new $3Dmol.Color();
		shape.wireframe = stylespec.wireframe ? true : false;
		shape.alpha = stylespec.alpha ? $3Dmol.Math.clamp(stylespec.alpha, 0.0,
				1.0) : 1.0;
		shape.side = (stylespec.side !== undefined) ? stylespec.side
				: $3Dmol.DoubleSide;

		// Click handling
		shape.clickable = stylespec.clickable ? true : false;
		shape.callback = typeof (stylespec.callback) === "function" ? stylespec.callback
				: null;
	};

	/**
	 * Custom renderable shape
	 * 
	 * @constructor $3Dmol.GLShape
	 * 
	 * @param {Number}
	 *            sid - Unique identifier
	 * @param {Object}
	 *            stylespec
	 * @returns {$3Dmol.GLShape}
	 */
	var GLShape = function(sid, stylespec) {

		stylespec = stylespec || {};
		$3Dmol.ShapeIDCount++;
		this.id = sid;

		this.boundingSphere = new $3Dmol.Sphere();
		/** @type {IntersectionShapes} */
		this.intersectionShape = {
			sphere : [],
			cylinder : [],
			line : [],
			triangle : []
		};

		updateFromStyle(this, stylespec);

		// Keep track of shape components and their centroids
		var components = [];
		var shapeObj = null;
		var renderedShapeObj = null;

		var geo = new $3Dmol.Geometry(true);

		/** Update shape with new style specification
		 * @param {ShapeSpec} newspec
		 * @return {$3Dmol.GLShape}
		 */
		this.updateStyle = function(newspec) {

			for ( var prop in newspec) {
				stylespec[prop] = newspec[prop];
			}

			updateFromStyle(this, stylespec);
		};

		/**
		 * Creates a custom shape from supplied vertex and face arrays
		 * @param {CustomSpec} customSpec
		 * @return {$3Dmol.GLShape}
		 */
		this.addCustom = function(customSpec) {

			customSpec.vertexArr = customSpec.vertexArr || [];
			customSpec.faceArr = customSpec.faceArr || [];
			customSpec.normalArr = customSpec.normalArr || [];
			customSpec.lineArr = customSpec.lineArr || [];

			// Force creation of new geometryGroup for each added component
			var geoGroup = geo.addGeoGroup();
			drawCustom(this, geoGroup, customSpec);
			geoGroup.truncateArrayBuffers(true, true);

			for (var i = 0; i < geoGroup.colorArray.length / 3; ++i) {
				geoGroup.colorArray[i * 3] = this.color.r;
				geoGroup.colorArray[i * 3 + 1] = this.color.g;
				geoGroup.colorArray[i * 3 + 2] = this.color.b;
			}

			components.push({
				id : geoGroup.id,
				geoGroup : geoGroup,
				centroid : geoGroup.getCentroid()
			});

			updateBoundingFromPoints(this.boundingSphere, components,
					geoGroup.vertexArray);
		};

		/**
		 * Creates a sphere shape
		 * @param {SphereSpec} sphereSpec
		 * @return {$3Dmol.GLShape}
		 */
		this.addSphere = function(sphereSpec) {

			sphereSpec.center = sphereSpec.center || {
				x : 0,
				y : 0,
				z : 0
			};
			sphereSpec.radius = sphereSpec.radius ? $3Dmol.Math.clamp(
					sphereSpec.radius, 0, Infinity) : 1.5;
			sphereSpec.color = $3Dmol.CC.color(sphereSpec.color);
			
			this.intersectionShape.sphere.push(new $3Dmol.Sphere(
					sphereSpec.center, sphereSpec.radius));

			var geoGroup = geo.addGeoGroup();
			$3Dmol.GLDraw.drawSphere(geo, sphereSpec.center,
					sphereSpec.radius, sphereSpec.color);
			geoGroup.truncateArrayBuffers(true, true);

			components.push({
				id : geoGroup.id,
				geoGroup : geoGroup, // has to be last group added
				centroid : new $3Dmol.Vector3(sphereSpec.center.x,
						sphereSpec.center.y, sphereSpec.center.z)
			});

			updateBoundingFromPoints(this.boundingSphere, components,
					geoGroup.vertexArray);
		};

		/**
		 * Creates a cylinder shape
		 * @param {CylinderSpec} cylinderSpec
		 * @return {$3Dmol.GLShape}
		 */
		this.addCylinder = function(cylinderSpec) {

			cylinderSpec.start = cylinderSpec.start || {};
			cylinderSpec.end = cylinderSpec.end || {};

			var start = new $3Dmol.Vector3(cylinderSpec.start.x || 0,
					cylinderSpec.start.y || 0, cylinderSpec.start.z || 0);
			var end = new $3Dmol.Vector3(cylinderSpec.end.x || 3,
					cylinderSpec.end.y || 0, cylinderSpec.end.z || 0);

			var radius = cylinderSpec.radius || 0.1;

			var color = $3Dmol.CC.color(cylinderSpec.color);


			var geoGroup = geo.addGeoGroup();

			$3Dmol.GLDraw.drawCylinder(geo, start, end, radius, color, cylinderSpec.fromCap, cylinderSpec.toCap);			
			geoGroup.truncateArrayBuffers(true, true);

			var centroid = new $3Dmol.Vector3();
			components.push({
				id : geoGroup.id,
				geoGroup : geoGroup,
				centroid : centroid.addVectors(cylinderSpec.start,
						cylinderSpec.end).multiplyScalar(0.5)
			});

			updateBoundingFromPoints(this.boundingSphere, components,
					geoGroup.vertexArray);

		};

		/**
		 * Creates an arrow shape
		 * @param {ArrowSpec} arrowSpec
		 * @return {$3Dmol.GLShape}
		 */
		this.addArrow = function(arrowSpec) {

			arrowSpec.start = arrowSpec.start || {};
			arrowSpec.end = arrowSpec.end || {};

			arrowSpec.start = new $3Dmol.Vector3(arrowSpec.start.x || 0,
					arrowSpec.start.y || 0, arrowSpec.start.z || 0);

			if (arrowSpec.dir instanceof $3Dmol.Vector3
					&& arrowSpec.length instanceof number) {
				var end = arrowSpec.dir.clone().multiplyScalar(length).add(
						start);
				arrowSpec.end = end;
			}

			else {
				arrowSpec.end = new $3Dmol.Vector3(arrowSpec.end.x || 3,
						arrowSpec.end.y || 0, arrowSpec.end.z || 0);
			}

			arrowSpec.radius = arrowSpec.radius || 0.1;

			arrowSpec.radiusRatio = arrowSpec.radiusRatio || 1.618034;
			arrowSpec.mid = (0 < arrowSpec.mid && arrowSpec.mid < 1) ? arrowSpec.mid
					: 0.618034;

			var geoGroup = geo.addGeoGroup();

			drawArrow(this, geoGroup, arrowSpec);
			geoGroup.truncateArrayBuffers(true, true);

			var centroid = new $3Dmol.Vector3();
			components.push({
				id : geoGroup.id,
				geoGroup : geoGroup,
				centroid : centroid.addVectors(arrowSpec.start, arrowSpec.end)
						.multiplyScalar(0.5)
			});

			updateBoundingFromPoints(this.boundingSphere, components,
					geoGroup.vertexArray);

		};
		
		/** 
		 * Creates custom shape from volumetric data 
		 * @param {string} data - Volumetric input data 
		 * @param {string} fmt - Input data format (e.g. 'cube' for cube file format)
		 * @param {VolSpec} volSpec - Volumetric data shape specification
		 * @return {$3Dmol.GLShape}
		 */
		this.addVolumetricData = function(data, fmt, volSpec) {

			// str, fmt, isoval, vxl
			var isoval = (volSpec.isoval !== undefined && typeof (volSpec.isoval) === "number") ? volSpec.isoval
					: 0.0;
			var vxl = (volSpec.voxel) ? true : false;

			var geoGroup = geo.addGeoGroup();

			// TODO: Initialize geometry group here (parseCube currently calls
			// addCustom...)
			switch (fmt) {
			case "cube":
				parseCube(this, geoGroup, data, isoval, vxl);
				break;
			}

			components.push({
				id : geoGroup.id,
				geoGroup : geoGroup,
				centroid : geoGroup.getCentroid()
			});

			this.updateStyle(volSpec);

			updateBoundingFromPoints(this.boundingSphere, components,
					geoGroup.vertexArray);

		};

		/**
		 * Initialize webgl objects for rendering
		 * @param {$3Dmol.Object3D} group
		 * 
		 */  
		this.globj = function(group) {

			geo.initTypedArrays();

			updateColor(geo, this.color);

			shapeObj = new $3Dmol.Object3D();
			var material = new $3Dmol.MeshLambertMaterial({
				wireframe : this.wireframe,
				vertexColors : true,
				ambient : 0x000000,
				reflectivity : 0,
				side : this.side,
				transparent : (this.alpha < 1) ? true : false,
				opacity : this.alpha
			});

			var mesh = new $3Dmol.Mesh(geo, material);
			shapeObj.add(mesh);

			if (renderedShapeObj) {
				group.remove(renderedShapeObj);
				renderedShapeObj = null;
			}
			renderedShapeObj = shapeObj.clone();
			group.add(renderedShapeObj);

		};

		this.removegl = function(group) {
			if (renderedShapeObj) {
				// dispose of geos and materials
				if (renderedShapeObj.geometry !== undefined)
					renderedShapeObj.geometry.dispose();
				if (renderedShapeObj.material !== undefined)
					renderedShapeObj.material.dispose();
				group.remove(renderedShapeObj);
				renderedShapeObj = null;
			}
			shapeObj = null;
		};

	};

	Object.defineProperty(GLShape.prototype, "position", {

		get : function() {
			return this.boundingSphere.center;
		}

	});

	Object.defineProperty(GLShape.prototype, "x", {

		get : function() {
			return this.boundingSphere.center.x;
		}

	});

	Object.defineProperty(GLShape.prototype, "y", {

		get : function() {
			return this.boundingSphere.center.y;
		}

	});

	Object.defineProperty(GLShape.prototype, "z", {

		get : function() {
			return this.boundingSphere.center.z;
		}

	});

	return GLShape;

}());

$3Dmol.ShapeIDCount = 0;