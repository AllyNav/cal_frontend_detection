const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const result = document.getElementById('result');
const blurWarning = document.getElementById('blur-warning');
const startButton = document.getElementById('start'); // Add this button in your HTML
const stopButton = document.getElementById('stop');  // Add this button in your HTML

let handDetector;
let video;
let animationFrame;

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoElement = document.createElement('video');
    videoElement.srcObject = stream;
    await videoElement.play();
    return videoElement;
  } catch (err) {
    console.error("Error accessing the camera:", err);
    alert("Camera access denied or not available.");
    throw err;
  }
}

async function main() {
  video = await setupCamera();

  video.addEventListener('loadeddata', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    handDetector = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    handDetector.setOptions({
      maxNumHands: 2,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    handDetector.onResults(onHandResults);
  });
}

function startProcessing() {
  detectBlurAndHands();
}

function stopProcessing() {
  cancelAnimationFrame(animationFrame);
}

function detectBlurAndHands() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Perform blur detection
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const grayData = toGrayscale(imageData.data);
  const laplacianVar = calculateLaplacianVariance(grayData, canvas.width, canvas.height);

  if (laplacianVar < 25) {
    blurWarning.textContent = "It is blur!";
    blurWarning.style.color = "red";
  } else {
    blurWarning.textContent = "It is not blur!";
    blurWarning.style.color = "green";
  }

  result.textContent = `Blur Variance: ${laplacianVar.toFixed(2)}`;

  // Send current frame to MediaPipe Hands
  handDetector.send({ image: video });

  animationFrame = requestAnimationFrame(detectBlurAndHands);
}

function onHandResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
      drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1 });
    }
  }
}

function toGrayscale(data) {
  const gray = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray.push(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

function calculateLaplacianVariance(grayData, width, height) {
  const laplacianKernel = [
    0, -1, 0,
    -1, 4, -1,
    0, -1, 0
  ];
  const laplacianData = convolve(grayData, laplacianKernel, width, height);

  const mean = laplacianData.reduce((sum, val) => sum + val, 0) / laplacianData.length;
  const variance = laplacianData.reduce((sum, val) => sum + (val - mean) ** 2, 0) / laplacianData.length;
  return variance;
}

function convolve(data, kernel, width, height) {
  const output = new Array(data.length).fill(0);
  const kernelSize = Math.sqrt(kernel.length);
  const halfKernel = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;

      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const pixelX = Math.min(Math.max(x + kx, 0), width - 1);
          const pixelY = Math.min(Math.max(y + ky, 0), height - 1);
          const kernelValue = kernel[(ky + halfKernel) * kernelSize + (kx + halfKernel)];
          const pixelValue = data[pixelY * width + pixelX];

          sum += pixelValue * kernelValue;
        }
      }
      output[y * width + x] = sum;
    }
  }
  return output;
}

// Event Listeners for Buttons
startButton.addEventListener('click', startProcessing);
stopButton.addEventListener('click', stopProcessing);

main();
