/**
 * Ball Road Runner - Road Generation
 * Matches original ROAD GENERATION section.
 */
var ballGame = window.ballGame;

ballGame.road = {};

// ─── generateRoadPoints ─────────────────────────────────
ballGame.road.generateRoadPoints = function(count) {
    const state = ballGame.state;
    const config = ballGame.config;

    let lastPoint = state.roadPoints.length > 0
        ? state.roadPoints[state.roadPoints.length - 1].clone()
        : new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < count; i++) {
        // Increase winding with difficulty
        const curveFactor = 0.02 + state.difficulty * 0.008;
        const curveChange = (Math.random() - 0.5) * curveFactor * 2;
        state.currentAngle += curveChange;
        // Clamp angle so road doesn't loop back
        state.currentAngle = Math.max(-0.8, Math.min(0.8, state.currentAngle));

        const dx = Math.sin(state.currentAngle) * config.ROAD_SEGMENT_LENGTH;
        const dz = -config.ROAD_SEGMENT_LENGTH;
        const newPoint = new THREE.Vector3(
            lastPoint.x + dx,
            0,
            lastPoint.z + dz
        );
        state.roadPoints.push(newPoint);
        lastPoint = newPoint;
        state.totalRoadGenerated += config.ROAD_SEGMENT_LENGTH;
    }

    ballGame.road.rebuildRoadCurve();
};

// ─── rebuildRoadCurve ───────────────────────────────────
ballGame.road.rebuildRoadCurve = function() {
    const state = ballGame.state;
    state.roadCurve = new THREE.CatmullRomCurve3(state.roadPoints, false, 'catmullrom', 0.5);
};

// ─── buildRoadMesh ──────────────────────────────────────
ballGame.road.buildRoadMesh = function(startIdx, endIdx) {
    const state = ballGame.state;
    const config = ballGame.config;

    if (!state.roadCurve || state.roadPoints.length < 4) return;

    const divisions = (endIdx - startIdx) * 3;

    for (let i = 0; i < divisions; i++) {
        const t1 = (startIdx + (i / divisions) * (endIdx - startIdx)) / (state.roadPoints.length - 1);
        const t2 = (startIdx + ((i + 1) / divisions) * (endIdx - startIdx)) / (state.roadPoints.length - 1);

        if (t1 < 0 || t1 > 1 || t2 < 0 || t2 > 1) continue;

        const p1 = state.roadCurve.getPoint(Math.min(t1, 1));
        const p2 = state.roadCurve.getPoint(Math.min(t2, 1));

        const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
        const right = new THREE.Vector3(-dir.z, 0, dir.x);

        const hw = config.ROAD_WIDTH / 2;

        // Road surface quad
        const v0 = new THREE.Vector3().copy(p1).add(right.clone().multiplyScalar(-hw));
        const v1 = new THREE.Vector3().copy(p1).add(right.clone().multiplyScalar(hw));
        const v2 = new THREE.Vector3().copy(p2).add(right.clone().multiplyScalar(hw));
        const v3 = new THREE.Vector3().copy(p2).add(right.clone().multiplyScalar(-hw));

        const geom = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            v0.x, 0.01, v0.z,
            v1.x, 0.01, v1.z,
            v2.x, 0.01, v2.z,
            v0.x, 0.01, v0.z,
            v2.x, 0.01, v2.z,
            v3.x, 0.01, v3.z,
        ]);
        geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geom.computeVertexNormals();

        const roadMesh = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ color: config.COLORS.road }));
        roadMesh.receiveShadow = true;
        state.scene.add(roadMesh);
        state.roadMeshes.push(roadMesh);

        // Edge lines (white dashes)
        if (i % 3 === 0) {
            const edgeGeo = new THREE.BoxGeometry(0.2, 0.05, 1.2);
            const edgeMat = new THREE.MeshLambertMaterial({ color: config.COLORS.roadEdge });

            const leftEdge = new THREE.Mesh(edgeGeo, edgeMat);
            leftEdge.position.copy(p1).add(right.clone().multiplyScalar(-hw + 0.3));
            leftEdge.position.y = 0.03;
            leftEdge.lookAt(p2.clone().add(right.clone().multiplyScalar(-hw + 0.3)));
            state.scene.add(leftEdge);
            state.edgeMeshes.push(leftEdge);

            const rightEdge = new THREE.Mesh(edgeGeo, edgeMat);
            rightEdge.position.copy(p1).add(right.clone().multiplyScalar(hw - 0.3));
            rightEdge.position.y = 0.03;
            rightEdge.lookAt(p2.clone().add(right.clone().multiplyScalar(hw - 0.3)));
            state.scene.add(rightEdge);
            state.edgeMeshes.push(rightEdge);
        }

        // Center dashes (gold)
        if (i % 6 === 0) {
            const dashGeo = new THREE.BoxGeometry(0.12, 0.04, 0.8);
            const dashMat = new THREE.MeshLambertMaterial({ color: config.COLORS.roadCenter });
            const dash = new THREE.Mesh(dashGeo, dashMat);
            const mid = new THREE.Vector3().lerpVectors(p1, p2, 0.5);
            dash.position.copy(mid);
            dash.position.y = 0.04;
            dash.lookAt(p2);
            state.scene.add(dash);
            state.edgeMeshes.push(dash);
        }
    }
};

// ─── addDecorations ─────────────────────────────────────
ballGame.road.addDecorations = function(startIdx, endIdx) {
    const state = ballGame.state;
    const config = ballGame.config;

    if (!state.roadCurve || state.roadPoints.length < 4) return;

    for (let i = startIdx; i < endIdx; i += 2) {
        const t = i / (state.roadPoints.length - 1);
        if (t < 0 || t > 1) continue;
        const p = state.roadCurve.getPoint(Math.min(t, 1));
        const nextT = Math.min(t + 0.01, 1);
        const p2 = state.roadCurve.getPoint(nextT);
        const dir = new THREE.Vector3().subVectors(p2, p).normalize();
        const right = new THREE.Vector3(-dir.z, 0, dir.x);

        // Trees on both sides
        for (let side = -1; side <= 1; side += 2) {
            if (Math.random() > 0.35) continue;
            const offset = (config.ROAD_WIDTH / 2 + 3 + Math.random() * 8) * side;
            const treePos = p.clone().add(right.clone().multiplyScalar(offset));

            // Trunk
            const trunkH = 1.5 + Math.random() * 1.5;
            const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, trunkH, 6);
            const trunkMat = new THREE.MeshLambertMaterial({ color: config.COLORS.treetrunk });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.copy(treePos);
            trunk.position.y = trunkH / 2;
            trunk.castShadow = true;
            state.scene.add(trunk);
            state.decorations.push(trunk);

            // Foliage
            const foliageR = 1 + Math.random() * 1.2;
            const foliageGeo = new THREE.SphereGeometry(foliageR, 8, 8);
            const foliageColor = config.COLORS.trees[Math.floor(Math.random() * config.COLORS.trees.length)];
            const foliageMat = new THREE.MeshLambertMaterial({ color: foliageColor });
            const foliage = new THREE.Mesh(foliageGeo, foliageMat);
            foliage.position.copy(treePos);
            foliage.position.y = trunkH + foliageR * 0.6;
            foliage.castShadow = true;
            state.scene.add(foliage);
            state.decorations.push(foliage);
        }

        // Small flowers
        if (Math.random() > 0.6) {
            for (let side = -1; side <= 1; side += 2) {
                const offset = (config.ROAD_WIDTH / 2 + 1.5 + Math.random() * 4) * side;
                const flowerPos = p.clone().add(right.clone().multiplyScalar(offset));
                const flowerGeo = new THREE.SphereGeometry(0.2 + Math.random() * 0.15, 6, 6);
                const flowerColor = config.COLORS.flowers[Math.floor(Math.random() * config.COLORS.flowers.length)];
                const flowerMat = new THREE.MeshLambertMaterial({ color: flowerColor });
                const flower = new THREE.Mesh(flowerGeo, flowerMat);
                flower.position.copy(flowerPos);
                flower.position.y = 0.2;
                state.scene.add(flower);
                state.decorations.push(flower);
            }
        }
    }
};

// ─── cleanupBehind ──────────────────────────────────────
ballGame.road.cleanupBehind = function() {
    const state = ballGame.state;
    const ballZ = state.ballGroup.position.z;
    const cleanThreshold = ballZ + 40;
    for (let i = state.roadMeshes.length - 1; i >= 0; i--) {
        const m = state.roadMeshes[i];
        const pos = new THREE.Vector3();
        m.geometry.computeBoundingBox();
        m.geometry.boundingBox.getCenter(pos);
        if (pos.z > cleanThreshold) {
            state.scene.remove(m);
            m.geometry.dispose();
            m.material.dispose();
            state.roadMeshes.splice(i, 1);
        }
    }

    for (let i = state.edgeMeshes.length - 1; i >= 0; i--) {
        if (state.edgeMeshes[i].position.z > cleanThreshold) {
            state.scene.remove(state.edgeMeshes[i]);
            state.edgeMeshes[i].geometry.dispose();
            state.edgeMeshes[i].material.dispose();
            state.edgeMeshes.splice(i, 1);
        }
    }

    for (let i = state.decorations.length - 1; i >= 0; i--) {
        if (state.decorations[i].position.z > cleanThreshold) {
            state.scene.remove(state.decorations[i]);
            state.decorations[i].geometry.dispose();
            state.decorations[i].material.dispose();
            state.decorations.splice(i, 1);
        }
    }
};

// ─── clearWorld ─────────────────────────────────────────
ballGame.road.clearWorld = function() {
    const state = ballGame.state;

    state.roadMeshes.forEach(function(m) { state.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
    state.roadMeshes = [];
    state.edgeMeshes.forEach(function(m) { state.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
    state.edgeMeshes = [];
    state.decorations.forEach(function(m) { state.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
    state.decorations = [];
    state.obstacles.forEach(function(m) { state.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
    state.obstacles = [];
};
