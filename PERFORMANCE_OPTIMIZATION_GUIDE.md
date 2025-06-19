# KartCompanion Performance Optimization Guide

## Overview
This guide outlines the performance optimizations implemented to reduce lag and stuttering when the extension is enabled, while preserving all functionality.

## Key Performance Issues Identified

### 1. WebSocket Proxy Overhead
**Problem**: The extension intercepts every WebSocket message, causing significant latency.
**Solution**: Implement message filtering and throttling.

### 2. Console Interception Overhead
**Problem**: All console.log calls go through the extension's processing pipeline.
**Solution**: Optimize console interception with early returns and pattern matching.

### 3. Frequent Storage Operations
**Problem**: Storage operations happen on every game event, blocking the main thread.
**Solution**: Implement batching and debouncing for storage operations.

### 4. Real-time DOM Manipulation
**Problem**: HUD updates cause layout thrashing and frame drops.
**Solution**: Use CSS transforms and hardware acceleration.

## Optimizations Implemented

### 1. WebSocket Message Throttling
```javascript
// Before: Process every message
ws.addEventListener("message", function(event) {
    // Process all messages immediately
});

// After: Throttle to ~60fps
const MESSAGE_THROTTLE_INTERVAL = 16; // ~60fps
let lastMessageTime = 0;

ws.addEventListener("message", function(event) {
    const now = Date.now();
    if (now - lastMessageTime < MESSAGE_THROTTLE_INTERVAL) {
        return; // Skip processing to maintain frame rate
    }
    lastMessageTime = now;
    // Process message
});
```

### 2. Message Filtering
```javascript
// Before: Parse JSON for every message
const data = JSON.parse(event.data);

// After: Quick string checks first
const relevantPatterns = [
    'gameStart', 'start_game', 'gameEnd', 'game_end',
    'playerKill', 'destroyed_human', 'playerDeath'
];

const isRelevant = relevantPatterns.some(pattern => 
    messageStr.includes(pattern)
);

if (!isRelevant) return; // Skip JSON parsing
```

### 3. Storage Operation Batching
```javascript
// Before: Immediate storage operations
chrome.storage.local.set({ key: value });

// After: Batched operations
let storageQueue = [];
let storageTimeout = null;
const STORAGE_BATCH_DELAY = 100;

function queueStorageOperation(operation) {
    storageQueue.push(operation);
    if (!storageTimeout) {
        storageTimeout = setTimeout(processStorageQueue, STORAGE_BATCH_DELAY);
    }
}
```

### 4. DOM Query Caching
```javascript
// Before: Query DOM on every access
function getPlayerInfo() {
    return document.querySelector("[data-player-info]");
}

// After: Cache with expiration
let playerInfoCache = null;
let lastPlayerInfoCheck = 0;
const PLAYER_INFO_CACHE_DURATION = 5000;

function getPlayerInfo() {
    const now = Date.now();
    if (playerInfoCache && (now - lastPlayerInfoCheck) < PLAYER_INFO_CACHE_DURATION) {
        return playerInfoCache;
    }
    // Query DOM and cache result
}
```

### 5. HUD Performance Optimizations
```javascript
// Before: Direct style manipulation
element.style.left = x + "px";
element.style.top = y + "px";

// After: CSS transforms with hardware acceleration
element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
element.style.willChange = "transform";
```

### 6. Console Interception Optimization
```javascript
// Before: Process every console call
function interceptConsole(methodName, originalMethod) {
    return function(...args) {
        // Always process
        processConsoleMessage(args[0]);
        return originalMethod.apply(console, args);
    };
}

// After: Early returns and pattern matching
function interceptConsole(methodName, originalMethod) {
    return function(...args) {
        if (isIntercepting) return originalMethod.apply(console, args);
        if (!args[0] || typeof args[0] !== "string") return originalMethod.apply(console, args);
        
        // Quick pattern checks before processing
        const message = args[0].toLowerCase();
        if (!relevantPatterns.some(p => message.includes(p))) {
            return originalMethod.apply(console, args);
        }
        // Process only relevant messages
    };
}
```

### 7. Mutation Observer Debouncing
```javascript
// Before: Process every mutation immediately
new MutationObserver((mutations) => {
    mutations.forEach(processMutation);
}).observe(document.body, { childList: true, subtree: true });

// After: Debounced processing
let mutationTimeout = null;
const MUTATION_DEBOUNCE_DELAY = 100;

new MutationObserver((mutations) => {
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
        mutations.forEach(processMutation);
    }, MUTATION_DEBOUNCE_DELAY);
}).observe(document.body, { childList: true, subtree: true });
```

### 8. Message Queue Batching
```javascript
// Before: Process messages immediately
window.addEventListener("message", handleMessage);

// After: Batched processing
let messageQueue = [];
let messageTimeout = null;
const MESSAGE_BATCH_DELAY = 50;

function queueMessage(message) {
    messageQueue.push(message);
    if (!messageTimeout) {
        messageTimeout = setTimeout(processMessageQueue, MESSAGE_BATCH_DELAY);
    }
}
```

## Implementation Steps

### Step 1: Replace content.js
1. Backup the original `content.js`
2. Replace with the optimized version that includes:
   - WebSocket message throttling
   - Storage operation batching
   - DOM query caching
   - HUD performance optimizations

### Step 2: Replace injected.js
1. Backup the original `injected.js`
2. Replace with the optimized version that includes:
   - Console interception optimization
   - Pattern matching for relevant messages
   - Debounced SKID updates

### Step 3: Update stats processing
1. Implement debounced stats updates (increase interval from 5s to 10s)
2. Add caching for frequently accessed data
3. Optimize complex calculations

### Step 4: Test Performance
1. Test with extension enabled vs disabled
2. Monitor frame rates and input lag
3. Verify all functionality still works

## Expected Performance Improvements

1. **Reduced WebSocket Latency**: Message throttling should reduce frame drops
2. **Lower CPU Usage**: Batching and caching reduce processing overhead
3. **Smoother HUD**: Hardware-accelerated transforms prevent layout thrashing
4. **Better Responsiveness**: Debounced operations prevent main thread blocking

## Monitoring and Validation

### Performance Metrics to Monitor
- Frame rate consistency
- Input lag reduction
- CPU usage during gameplay
- Memory usage patterns

### Functionality to Verify
- All stats tracking still works
- HUD displays update correctly
- Match data is saved properly
- All game modes are detected

## Rollback Plan

If performance issues persist or functionality is broken:
1. Restore original `content.js` and `injected.js`
2. Implement optimizations incrementally
3. Test each optimization individually
4. Monitor performance impact of each change

## Additional Recommendations

1. **Consider Web Workers**: Move heavy calculations to background threads
2. **Implement Virtual Scrolling**: For large match history lists
3. **Add Performance Monitoring**: Track extension impact in real-time
4. **User Feedback Loop**: Collect performance data from users

## Files to Optimize

1. `content.js` - Main performance bottleneck
2. `injected.js` - Console interception overhead
3. `stats-numbers.js` - Frequent calculations
4. `popup.js` - Storage operations
5. `visualizers.js` - Chart rendering

## Testing Checklist

- [ ] Extension loads without errors
- [ ] All HUD elements display correctly
- [ ] Stats tracking works in all game modes
- [ ] Match history is saved properly
- [ ] No console errors during gameplay
- [ ] Performance is acceptable on medium graphics
- [ ] No stuttering or frame drops
- [ ] Input lag is minimal 