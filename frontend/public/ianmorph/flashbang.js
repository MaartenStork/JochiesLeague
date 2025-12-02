// Flashbang version - auto-loads images and morphs ONCE
let img1, img2
let tex1, tex2
let texGraphic
let fbo, fbo2
let nodesData

const nodesPerSide = 10
let nodes1, nodes2

const sideLength = 800
let startTime = null
const animationDuration = 2000 // 2 seconds for the morph
let animationComplete = false
let imagesReady = false

function preload() {
  // Load nodes data AND images in preload so they're ready before setup
  nodesData = loadJSON('nodes (1).json')
  img1 = loadImage('IAN1.jpg')
  img2 = loadImage('IAN2.jpg')
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL)
  setAttributes({ premultipliedAlpha: true, antialias: true })
  texGraphic = createGraphics(1000, 1000)
  texGraphic.translate(texGraphic.width/2, texGraphic.height/2)
  texGraphic.imageMode(CENTER)
  
  fbo = createFramebuffer()
  fbo2 = createFramebuffer()
  
  drawingContext.pixelStorei(drawingContext.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  drawingContext.disable(drawingContext.DEPTH_TEST)
  
  // Process images into textures (they're already loaded from preload)
  if (img1) {
    texGraphic.clear()
    texGraphic.push()
    texGraphic.scale(min(texGraphic.width/img1.width, texGraphic.height/img1.height))
    texGraphic.image(img1, 0, 0)
    texGraphic.pop()
    tex1 = texGraphic.get()
  }
  
  if (img2) {
    texGraphic.clear()
    texGraphic.push()
    texGraphic.scale(min(texGraphic.width/img2.width, texGraphic.height/img2.height))
    texGraphic.image(img2, 0, 0)
    texGraphic.pop()
    tex2 = texGraphic.get()
  }
  
  imagesReady = (tex1 && tex2)
  
  // Parse nodes data
  if (nodesData && nodesData.length === 2) {
    nodes1 = nodesData[0]
    nodes2 = nodesData[1]
  } else {
    // Fallback to default grid
    nodes1 = makeInitialNodes()
    nodes2 = makeInitialNodes()
  }
}

function makeInitialNodes() {
  const nodes = []
  for (let x = 0; x < nodesPerSide; x++) {
    const u = x / (nodesPerSide - 1)
    for (let y = 0; y < nodesPerSide; y++) {
      const v = y / (nodesPerSide - 1)
      nodes.push({ x: u, y: v, u, v, proximity: 0 })
    }
  }
  return nodes
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
}

function draw() {
  clear() // Transparent background so app shows through
  
  // Start timer once textures are loaded
  if (tex1 && tex2 && startTime === null) {
    startTime = millis()
  }
  
  // Calculate progress (0 to 1, clamped)
  let t = 0
  if (startTime !== null) {
    t = min((millis() - startTime) / animationDuration, 1)
    if (t >= 1) {
      animationComplete = true
    }
  }
  
  fbo2.draw(() => {
    clear()
    // Play morph animation ONCE
    drawMorph(t)
  })
  
  push()
  noStroke()
  texture(fbo2.color)
  plane(width, -height)
  pop()
}

function drawMorph(t) {
  if (tex1 && tex2 && nodes1 && nodes2) {
    push()
    textureMode(NORMAL)
    
    // Scale to FILL entire screen (no white borders)
    const morphScale = max(width, height) / sideLength * 1.8
    
    const data = [{ img: tex1, id: 0, nodes: nodes1 }, { img: tex2, id: 1, nodes: nodes2 }]
    for (const frame of data) {
      let alpha = t
      if (frame.id === 0) alpha = 1 - alpha
      fbo.draw(() => {
        push()
        clear()
        texture(frame.img)
        noStroke()
        scale(morphScale)
        for (let row = 0; row < nodesPerSide - 1; row++) {
          beginShape(QUAD_STRIP)
          for (let col = 0; col < nodesPerSide; col++) {
            for (let off = 0; off < 2; off++) {
              const node1 = nodes1[(row + off) * nodesPerSide + col]
              const node2 = nodes2[(row + off) * nodesPerSide + col]
              const node = frame.id === 0 ? node1 : node2
              vertex(
                map(lerp(node1.x, node2.x, t), 0, 1, -sideLength/2, sideLength/2),
                map(lerp(node1.y, node2.y, t), 0, 1, -sideLength/2, sideLength/2),
                0,
                node.x,
                node.y
              )
            }
          }
          endShape()
        }
        pop()
      })
      push()
      blendMode(ADD)
      noStroke()
      texture(fbo.color)
      tint(255, alpha * 255)
      plane(width, -height)
      pop()
    }
    pop()
  }
}

