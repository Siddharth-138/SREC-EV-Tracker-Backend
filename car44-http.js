const Express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require('cors');
// const axios = require('axios');
const port = process.env.PORT || 3000;

const app = Express();
const server = http.Server(app);

const corsOptions = {
  origin: "*",
  methods: ['GET', 'POST']
};

app.use(cors(corsOptions)); // Use CORS middleware
app.use(Express.json()); // Middleware to parse JSON bodies

function convertToDecimal(degreeString, direction) {
  const degreeLength = direction === 'N' || direction === 'S' ? 2 : 3;
  const degrees = parseInt(degreeString.slice(0, degreeLength));
  const minutes = parseFloat(degreeString.slice(degreeLength));
  let decimal = degrees + (minutes / 60);

  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }

  return decimal;
}

function parseDate(dateString) {
  const day = dateString.slice(0, 2);
  const month = dateString.slice(2, 4);
  const year = dateString.slice(4, 6);
  return `20${year}-${month}-${day}`;
}

function parseTime(timeString) {
  const hours = timeString.slice(0, 2);
  const minutes = timeString.slice(2, 4);
  const seconds = timeString.slice(4);
  return `${hours}:${minutes}:${seconds}`;
}

function isValidNMEA(parts) {
  if (parts.length < 9) {
    return false;
  }

  const [rawLat, latDirection, rawLon, lonDirection, date, time] = parts;

  if (!rawLat || !latDirection || !rawLon || !lonDirection || !date || !time) {
    return false;
  }

  if (!/^\d{2}\d+\.\d+$/.test(rawLat) || !/^[NS]$/.test(latDirection)) {
    return false;
  }

  if (!/^\d{3}\d+\.\d+$/.test(rawLon) || !/^[EW]$/.test(lonDirection)) {
    return false;
  }

  if (!/^\d{6}$/.test(date) || !/^\d{6}\.\d$/.test(time)) {
    return false;
  }

  return true;
}

function parseData(data) {
  const parts = data.split(',');

  if (!isValidNMEA(parts)) {
    console.warn('Invalid NMEA data');
    return null;
  }

  const rawLat = parts[0];
  const latDirection = parts[1];
  const rawLon = parts[2];
  const lonDirection = parts[3];
  const date = parts[4];
  const time = parts[5];
  const altitude = parseFloat(parts[6]);
  const speed = parseFloat(parts[7]);
  const course = parseFloat(parts[8]);

  const latitude = convertToDecimal(rawLat, latDirection);
  const longitude = convertToDecimal(rawLon, lonDirection);

  return {
    latitude,
    longitude,
    date: parseDate(date),
    time: parseTime(time),
    altitude,
    speed,
    course
  };
}

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ['GET', 'POST']
  },
});

// Endpoint to receive data from SIM7600E-H module LEGACY CODE
// app.post('/test', async (req, res) => {
//   try {
//     // Log received data from SIM7600E-H
//     console.log('Received data from SIM7600E-H:', req.body);
//     const { carId, latitude, longitude } = req.body;

//     // Just temp, have to work on it
//     const otherEndpoint = 'https://blueband-backend.onrender.com/track';
//     const dataToSend = { carId, latitude, longitude };

//     // Make a POST request to another endpoint
//     const response = await axios.post(otherEndpoint, dataToSend);

//     // Log response from the other endpoint
//     console.log('Response from other endpoint:', response.data);

//     // Respond to the SIM7600E-H module with a success message
//     res.status(200).send('Data received and forwarded successfully.');
//   } catch (err) {
//     console.error('Error handling data:', err);
//     res.status(500).json({ msg: "Internal Server Error" });
//   }
// });

app.post('/track', (req, res) => {
  try {
  
    
    console.log('Received data from SIM7600E-H:', req.body);

    const {nmea,carId} = req.body
    const {latitude,longitude,speed} = parseData(nmea);
    const record = { carId, latitude, longitude, speed };

    if (typeof carId === 'undefined') {
      res.status(400).json({ msg: "CarID Undefined" });
      return;
    }
    io.emit('locationUpdate', [record]);
    console.log(record);
    res.status(200).json({ msg: "Location updated successfully" });
  } catch (err) {
    console.error('Error handling data:', err);
    res.status(500).json({ msg: "Internal Server Error" });
  }
});


app.post('/sos', (req, res) => {
  const { carId, message } = req.body;
  const sosMessage = { carId, message, timestamp: new Date() };

  io.emit('sos', sosMessage);
  res.status(200).send({ message: 'SOS alert sent successfully' });
});

app.post('/ok', (req, res) => {
  const { carId, message } = req.body;
  const okMessage = { carId, message, timeStamp: new Date() };
  io.emit("ok", [okMessage]);
  console.log("OK status updated", carId);
  res.status(200).send([{ okMessage, message: `OK status updated ${carId}` }]);
});

io.on('connection', (socket) => {
  console.log("Connected to device", socket.id);
});

server.listen(port, () => {
  console.log("Listening at:", port);
});