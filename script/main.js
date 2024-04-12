/*
* WebRTC test using WebSocket.
*/

'use strict';

const registerButton = document.getElementById('register-button');
const requestButton = document.getElementById('request-button');
const nextButton = document.getElementById('next-button');
const stopButton = document.getElementById('stop-button');
const remoteVideo01 = document.getElementById('remote-video-01');
const remoteVideo02 = document.getElementById('remote-video-02');

const webSocket = new WebSocket('ws://localhost:8080/websocket-webrtc');

// RTCConfiguration received from server.
let configuration;
// Map of peer connections.
let mapOfPeerConnections = new Map();
// Media stream from RTSP URLs.
let stream;

webSocket.onerror = (error) => {
    console.error('-- WebSocket error:', error);
    alert('Unable to connect to server. Please try again later.');
};

webSocket.onopen = () => {
    console.log('-- WebSocket connection established.');
    if (registerButton) registerButton.disabled = false;
    if (requestButton) requestButton.disabled = false;
};

webSocket.onmessage = (event) => {
    console.debug('-- Message received from WebSocket:', event.data);
    const message = JSON.parse(event.data);

    switch (message.type) {
        case 'CONFIG':
            handleConfigMessage(message);
            break;
        case 'REQUEST':
            handleRequestMessage(message);
            break;
        case 'RESPONSE':
            handleResponseMessage(message);
            break;
        case 'OFFER':
            handleOfferMessage(message);
            break;
        case 'ANSWER':
            handleAnswerMessage(message);
            break;
        case 'CANDIDATE':
            handleCandidateMessage(message);
            break;
        case 'ERROR':
            handleErrorMessage(message);
            break;
        default:
            handleUnknownMessage(message);
            break;
    }
};

function handleConfigMessage(message) {
    // RTCConfiguration configuration received from server.
    configuration = JSON.parse(message.payload);

    console.log(`-- Configuration received from server:`, configuration);
}

function handleRequestMessage(message) {
    console.log(`-- Request received from ${message.from} with payload:`, message.payload);

    // Get available RTSP URLs.
    getAvailableUrls(message.payload.split(',')).then((urls) => {
        console.log('-- Active RTSP URLs:', urls);
        // Prepare media tracks from RTSP URLs.
        getMediaStream(urls).then((stream) => {
            // Create peer connection.
            try {
                const remotePeerId = message.from;
                const peerConnection = new WebRTCPeerConnection(configuration, remotePeerId, stream);

                if (peerConnection) {
                    // Firstly, send response to server with get-at-able RTSP URLs.
                    try {
                        webSocket.send(JSON.stringify({ to: message.from, type: 'RESPONSE', payload: urls.join(',') }));
                    } catch (error) {
                        console.error('-- Failed to send response:', error);
                    }

                    // Secondly, Create offer.
                    peerConnection.createOffer();

                    // Store peer connection.
                    mapOfPeerConnections.set(remotePeerId, peerConnection);
                }

                // Enable stop button.
                if (stopButton) stopButton.disabled = false;
            } catch (error) {
                console.error('-- Failed to create peer connection:', error);
            };
        }).onerror = (error) => {
            console.error('-- Failed to get media stream(s):', error);
        };
    }).onerror = (error) => {
        console.error('-- Failed to available RTSP URL(s):', error);
    };
}

function handleResponseMessage(message) {
    console.log(`-- Response received from ${message.from} with payload:`, message.payload);

    // Create peer connection.
    try {
        const remotePeerId = message.from;
        const peerConnection = new WebRTCPeerConnection(configuration, remotePeerId);

        // Store peer connection.
        if (peerConnection) {
            mapOfPeerConnections.set(remotePeerId, peerConnection);
        }

        // Enable stop button.
        if (stopButton) stopButton.disabled = false;
    } catch (error) {
        console.error('-- Failed to create peer connection:', error);
    }
}

function handleOfferMessage(message) {
    console.log(`-- Offer received from ${message.from} with payload ${message.payload.substring(0, 200)}...`);

    // Set remote description.
    try {
        const remotePeerId = message.from;
        const peerConnection = mapOfPeerConnections.get(remotePeerId);

        if (peerConnection) {
            peerConnection.setRemoteDescription(message.payload);

            // Create answer.
            peerConnection.createAnswer().onerror = (error) => {
                console.error('-- Failed to create answer:', error);
            };
        } else {
            console.error(`-- Peer connection for ${remotePeerId} not found to accept offer.`);
        }
    } catch (error) {
        console.error('-- Failed to set remote description:', error);
    }
}

function handleAnswerMessage(message) {
    console.log(`-- Answer received from ${message.from} with payload ${message.payload.substring(0, 200)}...`);

    // Set remote description.
    try {
        const remotePeerId = message.from;
        const peerConnection = mapOfPeerConnections.get(remotePeerId);

        if (peerConnection) {
            peerConnection.setRemoteDescription(message.payload);
        } else {
            console.error(`-- Peer connection for ${remotePeerId} not found to accept answer.`);
        }
    } catch (error) {
        console.error('-- Failed to set remote description:', error);
    }
}

function handleCandidateMessage(message) {
    console.log(`-- Candidate received from ${message.from} with payload ${message.payload}.`);

    // Add ICE candidate.
    try {
        const remotePeerId = message.from;
        const peerConnection = mapOfPeerConnections.get(remotePeerId);

        if (peerConnection) {
            peerConnection.addIceCandidate(message.payload);
        } else {
            console.error(`-- Peer connection for ${remotePeerId} not found to add ICE candidate.`);
        }
    } catch (error) {
        console.error('-- Failed to add ICE candidate:', error);
    }
}

function handleErrorMessage(message) {
    console.error(`-- Error message received from ${message.from == null ? 'server' : message.from} with payload ${message.payload}.`);
    alert(message.payload);
}

function handleUnknownMessage(message) {
    console.error(`-- Unknown message type ${message.type} from ${message.from} with payload ${message.payload}.`);
}

class WebRTCPeerConnection {
    constructor(configuration, remotePeerId, stream) {
        this.remotePeerId = remotePeerId;
        this.configuration = configuration;
        this.peerConnection = new RTCPeerConnection(this.configuration);

        if (stream) {
            stream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, stream);
            });
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log(`-- Connection state: ${this.peerConnection.connectionState}`);
        };
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log(`-- ICE connection state: ${this.peerConnection.iceConnectionState}`);
        };
        this.peerConnection.onicegatheringstatechange = (event) => {
            switch (event.target.iceGatheringState) {
                case "gathering":
                    console.log(`-- Collection of ICE candidates has begun.`);
                    break;
                case "new":
                    console.log(`-- New ICE candidate received.`);
                    break;
                case "complete":
                    console.log(`-- Collection of ICE candidates completed.`);
                    break;
            }
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate == null) {
                console.log(`-- There are no more ICE candidates coming during this negotiation.`);
            } else {
                console.log(`-- Sending this ICE candidate (${event.candidate.candidate}) to other peer ${this.remotePeerId}.`);
                webSocket.send(JSON.stringify({ to: this.remotePeerId, type: 'CANDIDATE', payload: JSON.stringify(event.candidate) }));
            }
        };
        this.peerConnection.onicecandidateerror = (event) => {
            console.error(`-- ICE candidate error: ${event.errorCode} - ${event.url} - ${event.errorText}`);
        };

        this.peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            remoteVideo01.srcObject = remoteStream;
        };
    }

    async addIceCandidate(candidate) {
        try {
            await this.peerConnection.addIceCandidate(JSON.parse(candidate));
            console.log("-- ICE Candidate added.");
        } catch (error) {
            console.error("-- Failed to add ICE Candidate:", error);
        }
    }

    async setRemoteDescription(offer) {
        try {
            const description = JSON.parse(offer);
            await this.peerConnection.setRemoteDescription(description);
            console.log(`-- ${description.type} Accepted.`);
        } catch (error) {
            console.error("-- Failed to set remote description:", error);
        }
    }

    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            console.log(`-- Sending offer to remote peer ${this.remotePeerId}.`);
            webSocket.send(JSON.stringify({ to: this.remotePeerId, type: 'OFFER', payload: JSON.stringify(offer) }));
        } catch (error) {
            console.error("-- Failed to create or send offer:", error);
        }
    }

    async createAnswer() {
        try {
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            console.log(`-- Sending answer to remote peer ${this.remotePeerId}.`);
            webSocket.send(JSON.stringify({ to: this.remotePeerId, type: 'ANSWER', payload: JSON.stringify(answer) }));
        } catch (error) {
            console.error("-- Failed to create or send answer:", error);
        }
    }

    async close() {
        try {
            this.peerConnection.close();
            console.log("-- Peer connection closed.");
        } catch (error) {
            console.error("-- Failed to close peer connection:", error);
        }
    }
}

async function getRtspUrls() {
    // Your code here to return selected RTSP URLs in following format:
    // [{ id: numeric-proxy-id, urls: [rtsp-url-1, rtsp-url-2, ...] }, ...]
    return [{ id: 12345, urls: ["rtsp://admin@password:192.168.1.101:/media/main", "rtsp://admin@password:192.168.1.102:/media/main"] }];
}
async function getAvailableUrls(urls) {
    // For testing purposes, return 1st URLs as active
    return [urls[0]];
}
async function getMediaStream(urls) {
    // For testing purposes, returning integreted camera stream
    return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
}


window.onload = async () => {
    console.log('-- Ready to start.');
}
if (registerButton) {
    registerButton.onclick = async () => {
        try {
            registerButton.disabled = true;

            // Send registration request to server.
            webSocket.send(JSON.stringify({ type: 'REGISTER', payload: '12345' }));
        } catch (reason) {
            alert(reason);
        }
    };
}
if (requestButton) {
    requestButton.onclick = async () => {
        try {
            requestButton.disabled = true;

            // Get RTSP URLs.
            let rtspUrls = await getRtspUrls();

            // Send request to server with RTSP URLs.
            rtspUrls.forEach((elements) => {
                webSocket.send(JSON.stringify({ to: elements.id, type: 'REQUEST', payload: elements.urls.join(',') }));
            });
        } catch (reason) {
            alert(reason);
        }
    };
}
if (stopButton) {
    stopButton.onclick = async () => {
        try {
            stopButton.disabled = true;

            // Close all peer connections.
            mapOfPeerConnections.forEach((peerConnection) => peerConnection.close());

        } catch (reason) {
            alert(reason);
        }
    };
}
