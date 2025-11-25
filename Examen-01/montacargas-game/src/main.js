import "./style.css";
import "@babylonjs/loaders/glTF"; // habilita .glb

import {
  Engine,
  Scene,
  Vector3,
  Color3,
  Color4,
  ArcRotateCamera,
  FreeCamera,              
  HemisphericLight,
  DirectionalLight,
  PointLight,
  MeshBuilder,
  StandardMaterial,
  Texture,
  TransformNode,
  SceneLoader,
} from "@babylonjs/core";

const canvas = document.getElementById("renderCanvas");
const engine = new Engine(canvas, true);
const statusEl = document.getElementById("status");

const createScene = async () => {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.07, 0.1, 1);

  /* ---------------- CAMARA DE CONDUCCIÓN (tu cámara actual) ---------------- */
  const driveCam = new ArcRotateCamera(
    "driveCam",
    Math.PI * 1.5,
    Math.PI * 0.37,
    28,
    new Vector3(0, 4, 0),
    scene
  );
  driveCam.lowerRadiusLimit = 10;
  driveCam.upperRadiusLimit = 30;

  driveCam.inputs.attached.pointers.usePointerLock = true;
  driveCam.angularSensibilityX = 3500;
  driveCam.angularSensibilityY = 3500;

  /* ---------------- CAMARA A PIE (1ra persona) ---------------- */
  const footCam = new FreeCamera("footCam", new Vector3(0, 1.7, -8), scene);
  footCam.attachControl(canvas, true);
  footCam.speed = 0.6;
  footCam.angularSensibility = 3500;

  // WASD + flechas
  footCam.keysUp.push(87);    // W
  footCam.keysDown.push(83);  // S
  footCam.keysLeft.push(65);  // A
  footCam.keysRight.push(68); // D

  // empezamos caminando
  scene.activeCamera = footCam;

  /* ---------------- LUCES ---------------- */
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.9;

  const dir = new DirectionalLight("dir", new Vector3(-0.4, -1, -0.3), scene);
  dir.position = new Vector3(10, 20, 10);
  dir.intensity = 0.8;

  /* ---------------- SUELO CON TEXTURA ---------------- */
  const ground = MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);

  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseTexture = new Texture("assets/concrete_basecolor.jpg", scene);
  groundMat.bumpTexture = new Texture("assets/concrete_normal.jpg", scene);

  if (groundMat.diffuseTexture) {
    groundMat.diffuseTexture.uScale = 6;
    groundMat.diffuseTexture.vScale = 6;
  }

  groundMat.specularColor = new Color3(0.1, 0.1, 0.1);
  ground.material = groundMat;

  /* ---------------- PAREDES SIMPLES (SIN COLISION) ---------------- */
  const wallMat = new StandardMaterial("wallMat", scene);
  wallMat.diffuseColor = new Color3(0.35, 0.36, 0.4);

  const makeWall = (x, z, w, h, d) => {
    const wall = MeshBuilder.CreateBox("wall", { width: w, height: h, depth: d }, scene);
    wall.position.set(x, h / 2, z);
    wall.material = wallMat;
    return wall;
  };

  makeWall(0, -50, 100, 40, 0.8);
  makeWall(0, 50, 100, 40, 0.8);
  makeWall(-50, 0, 0.8, 40, 100);
  makeWall(50, 0, 0.8, 40, 100);

  /* ---------------- ZONAS ---------------- */
  const pickupZone = MeshBuilder.CreateBox("pickupZone", { width: 20, height: 0.2, depth: 8 }, scene);
  pickupZone.position = new Vector3(-12, 0.1, -10);
  const pickupMat = new StandardMaterial("pickupMat", scene);
  pickupMat.diffuseColor = new Color3(0.1, 0.7, 0.2);
  pickupMat.alpha = 0.55;
  pickupZone.material = pickupMat;

  const deliveryZone = MeshBuilder.CreateBox("deliveryZone", { width: 7, height: 0.2, depth: 7 }, scene);
  deliveryZone.position = new Vector3(20, 0.1, 25);
  const deliveryMat = new StandardMaterial("deliveryMat", scene);
  deliveryMat.diffuseColor = new Color3(0.15, 0.4, 0.9);
  deliveryMat.alpha = 0.55;
  deliveryZone.material = deliveryMat;

  // Ocultar zonas
  pickupZone.isVisible = false;
  pickupZone.isPickable = false;
  deliveryZone.isVisible = false;
  deliveryZone.isPickable = false;

  /* ---------------- AMBIENTE DE BODEGA ---------------- */
  scene.fogMode = Scene.FOGMODE_EXP;
  scene.fogDensity = 0.015;
  scene.fogColor = new Color3(0.07, 0.08, 0.1);

  // Techo
  const ceiling = MeshBuilder.CreateBox("ceiling", { width: 100, height: 0.4, depth: 100 }, scene);
  ceiling.position.y = 20;
  const ceilMat = new StandardMaterial("ceilMat", scene);
  ceilMat.diffuseColor = new Color3(0.18, 0.18, 0.2);
  ceiling.material = ceilMat;

  // Luces industriales (pocas para evitar error de shader)
  const lampPositions = [
    new Vector3(-20, 40, -15),
    new Vector3(  0, 35, -15),
    new Vector3( 20, 35, -15),
    new Vector3(-20, 35,  15),
    new Vector3(  0, 35,  15),
    new Vector3( 20, 35,  15),
  ];

  lampPositions.forEach((pos, i) => {
    const lamp = MeshBuilder.CreateSphere("lamp"+i, { diameter: 0.6 }, scene);
    lamp.position = pos;

    const lampMat = new StandardMaterial("lampMat"+i, scene);
    lampMat.emissiveColor = new Color3(1, 1, 0.9);
    lamp.material = lampMat;

    const pl = new PointLight("pl"+i, pos, scene);
    pl.intensity = 1.2;
    pl.range = 60;
  });

  /* ---------------- JUGADOR ROOT ---------------- */
  statusEl.innerHTML = "Cargando montacargas…";

  const forkliftRoot = new TransformNode("forkliftRoot", scene);
  forkliftRoot.position = new Vector3(0, 0, 0);

  const forkliftModelFix = new TransformNode("forkliftModelFix", scene);
  forkliftModelFix.parent = forkliftRoot;
  forkliftModelFix.rotation.y = 0;

  const forkliftRes = await SceneLoader.ImportMeshAsync("", "assets/", "forklift.glb", scene);
  const forkliftMesh = forkliftRes.meshes[0];
  forkliftMesh.parent = forkliftModelFix;
  forkliftMesh.position = Vector3.Zero();
  forkliftMesh.scaling = new Vector3(0.03, 0.03, 0.03);
  forkliftMesh.rotationQuaternion = null;
  forkliftMesh.rotation = Vector3.Zero();

  /* ---------------- PUNTO DE ANCLAJE PARA PALET ---------------- */
  const forkAttach = new TransformNode("forkAttach", scene);
  forkAttach.parent = forkliftModelFix;
  forkAttach.position = new Vector3(0, 0.45, 4.6);

  /* ---------------- CARGAR 3 PALETS APILADOS ---------------- */
  statusEl.innerHTML = "Cargando palés…";
  const palletRes = await SceneLoader.ImportMeshAsync("", "assets/", "pallet.glb", scene);

  const palletProto = palletRes.meshes[0];
  palletProto.scaling = new Vector3(1, 1, 1);

  const palletBasePos = pickupZone.position.add(new Vector3(0, 0.25, 0));
  const stackSpacingY = 0.35;

  const pallet1 = palletProto;
  const pallet2 = palletProto.clone("pallet2");
  const pallet3 = palletProto.clone("pallet3");

  pallet1.position = palletBasePos.clone();
  pallet2.position = palletBasePos.add(new Vector3(0, stackSpacingY, 0));
  pallet3.position = palletBasePos.add(new Vector3(0, stackSpacingY * 2, 0));

  const palletsStack = [pallet1, pallet2, pallet3];
  let carriedPallet = null;

  /* ---------------- CARGAR CAMION GLB ---------------- */
  statusEl.innerHTML = "Cargando camión…";
  const truckRes = await SceneLoader.ImportMeshAsync("", "assets/", "truck.glb", scene);
  const truck = truckRes.meshes[0];
  truck.position = new Vector3(20, 0, 0);
   
  const truckScale = 2;
  truckRes.meshes.forEach(m => {
    m.scaling = new Vector3(truckScale, truckScale, truckScale);
  });
  truck.rotation.y = Math.PI*2;

  /* ---------------- ESTADO DE JUEGO ---------------- */
  let hasPallet = false;

  let deliveredCount = 0;
  const deliveriesGoal = 3;
  let showWinTimer = 0;

  // ✅ MODO DE JUEGO: a pie / conduciendo
  let mode = "onFoot";   // "onFoot" | "driving"
  const MOUNT_RADIUS = 8.0;
  scene.onPointerDown = () => {
    if (mode === "driving" && !scene.getEngine().isPointerLock) {
      canvas.requestPointerLock?.();
    }
  };
  const inputMap = {};
  scene.onKeyboardObservable.add((kbInfo) => {
    const key = kbInfo.event.key.toLowerCase();

    if (kbInfo.type === 1) { // KEYDOWN
      inputMap[key] = true;

      if (key === "e") {
        if (mode === "onFoot") tryMountForklift(); // ✅ subir
        else tryPickup();                          // ✅ recoger
      }

      if (key === "q" && mode === "driving") tryDeliver(); // ✅ entregar solo manejando

      if (key === "r" && mode === "driving") tryDismount(); // ✅ bajar
    } else { // KEYUP
      inputMap[key] = false;
    }
  });

  /* ---------------- MOVIMIENTO ---------------- */
  const speed = 0.12;

  scene.onBeforeRenderObservable.add(() => {
    // Mantener cámara a pie pegada al piso
    if (mode === "onFoot") {
      footCam.position.y = 5;
    }

    // ✅ SOLO mover montacargas si estás montado
    if (mode === "driving") {
      let moveX = 0, moveZ = 0;

      if (inputMap["w"] || inputMap["arrowup"]) moveZ += 1;
      if (inputMap["s"] || inputMap["arrowdown"]) moveZ -= 1;
      if (inputMap["a"] || inputMap["arrowleft"]) moveX -= 1;
      if (inputMap["d"] || inputMap["arrowright"]) moveX += 1;

      const dirVec = new Vector3(moveX, 0, moveZ);

      if (dirVec.length() > 0) {
        dirVec.normalize();
        forkliftRoot.position.addInPlace(dirVec.scale(speed));
        forkliftRoot.rotation.y = Math.atan2(dirVec.x, dirVec.z);
      }

    }

    updateHUD();
  });

  /* ---------------- SUBIR / BAJAR ---------------- */
  function tryMountForklift() {
    const dist = Vector3.Distance(footCam.position, forkliftRoot.position);
    if (dist < MOUNT_RADIUS) {
      mode = "driving";

      footCam.detachControl(canvas);
      scene.activeCamera = driveCam;
      driveCam.attachControl(canvas, true);

      // pon cámara mirando al montacargas
      driveCam.lockedTarget = forkliftRoot;
      driveCam.target = forkliftRoot.position.add(new Vector3(0, 1.5, 0));
       canvas.requestPointerLock?.();
      statusEl.innerHTML = "🚜 Montado. Ahora maneja el montacargas.";
    }
  }

  function tryDismount() {
    mode = "onFoot";

    driveCam.lockedTarget = null;
    driveCam.detachControl(canvas);
    scene.activeCamera = footCam;
    footCam.attachControl(canvas, true);
    
    // reapareces al lado del montacargas
    footCam.position = forkliftRoot.position.add(new Vector3(2, 1.7, 0));

    statusEl.innerHTML = "🚶 Bajaste del montacargas.";
  }

  /* ---------------- LOGICA RECOGER ---------------- */
  function tryPickup() {
    if (hasPallet) return;
    if (palletsStack.length === 0) return;

    const topPallet = palletsStack[palletsStack.length - 1];

    const dist = Vector3.Distance(forkliftRoot.position, topPallet.getAbsolutePosition());
    const PICKUP_RADIUS = 10; // recoge antes

    if (dist < PICKUP_RADIUS) {
      hasPallet = true;

      carriedPallet = palletsStack.pop();
      carriedPallet.parent = forkAttach;
      carriedPallet.position = Vector3.Zero();
      carriedPallet.rotation = Vector3.Zero();
    }
  }

  /* ---------------- LOGICA ENTREGAR ---------------- */
  function tryDeliver() {
    if (!hasPallet || !carriedPallet) return;

    const dist = Vector3.Distance(forkliftRoot.position, deliveryZone.position);
    if (dist < 6.0) {
      hasPallet = false;

      carriedPallet.parent = null;
      carriedPallet.position = deliveryZone.position.add(new Vector3(0, 4.5, -10));
      carriedPallet = null;

      deliveredCount++;
      showWinTimer = 120;

      if (deliveredCount >= deliveriesGoal) {
        statusEl.innerHTML = `<b style="color:#ffd34f;font-size:16px">
          🎉 ¡MISIÓN COMPLETADA! Entregaste ${deliveredCount} palés.
        </b>`;
        scene.onBeforeRenderObservable.clear();
        return;
      }
    }
  }

  /* ---------------- HUD ---------------- */
  function updateHUD() {
    const remaining = palletsStack.length;

    let distPickup = 999;
    if (remaining > 0) {
      const topPallet = palletsStack[remaining - 1];
      distPickup = Vector3.Distance(forkliftRoot.position, topPallet.getAbsolutePosition());
    }

    const distDelivery = Vector3.Distance(forkliftRoot.position, deliveryZone.position);
    const distMount = Vector3.Distance(footCam.position, forkliftRoot.position);

    let msg = `Modo: <b>${mode === "onFoot" ? "🚶 A pie" : "🚜 Montacargas"}</b><br>`;
    msg += `Entregas: <b>${deliveredCount}/${deliveriesGoal}</b><br>`;
    msg += `Palés restantes: <b>${remaining}</b><br>`;
    msg += `Estado: ${hasPallet ? "✅ Llevas un palé" : "❌ Sin palé"}<br>`;
    msg += `Distancia a palé: ${remaining > 0 ? distPickup.toFixed(2) : "—"}<br>`;
    msg += `Distancia a entrega: ${distDelivery.toFixed(2)}<br><br>`;

    if (mode === "onFoot") {
      if (distMount < MOUNT_RADIUS) {
        msg += "👉 Presiona <b>E</b> para subir al montacargas.";
      } else {
        msg += "Camina hacia el montacargas para montarte.";
      }
    } else {
      if (!hasPallet && remaining > 0 && distPickup < 4.0) msg += "👉 <b>E</b> para recoger.";
      else if (hasPallet && distDelivery < 3.0) msg += "👉 <b>Q</b> para entregar.";
      else if (!hasPallet && remaining > 0) msg += "Busca un palé para recoger.";
      else if (!hasPallet && remaining === 0) msg += "🚫 Ya no quedan palés.";
      else msg += "Lleva el palé a la zona azul.";
      msg += "<br>👉 Presiona <b>R</b> para bajarte.";
    }

    statusEl.innerHTML = msg;
  }

  statusEl.innerHTML = "✅ Listo. Empiezas caminando en 1ra persona.";
  return scene;
};

/* ---------------- RUN ---------------- */
createScene().then((scene) => {
  engine.runRenderLoop(() => scene.render());
});

window.addEventListener("resize", () => engine.resize());
canvas.focus();
