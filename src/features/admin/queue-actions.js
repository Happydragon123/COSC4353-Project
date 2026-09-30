import {
  adminQueues,
  updateAdminQueues
} from '../../data/store.js';


function getQueue(queues, serviceId) {
  if (!Array.isArray(queues[serviceId])) {
    queues[serviceId] = [];
  }

  return queues[serviceId];
}


export function serveNextUser(serviceId) {
  const queues = adminQueues();
  const queue = getQueue(queues, serviceId);

  if (queue.length === 0) {
    return null;
  }

  const servedUser = queue.shift();

  updateAdminQueues(queues);

  return servedUser;
}


export function removeQueueUser(serviceId, userId) {
  const queues = adminQueues();
  const queue = getQueue(queues, serviceId);

  const index = queue.findIndex(user => user.id === userId);

  if (index === -1) {
    return null;
  }

  const removedUser = queue.splice(index, 1)[0];

  updateAdminQueues(queues);

  return removedUser;
}


export function moveQueueUser(serviceId, userId, direction) {
  const queues = adminQueues();
  const queue = getQueue(queues, serviceId);

  const currentIndex =
    queue.findIndex(user => user.id === userId);

  if (currentIndex === -1) {
    return null;
  }

  let newIndex = currentIndex;

  if (direction === 'up') {
    newIndex--;
  } else if (direction === 'down') {
    newIndex++;
  }

  if (
    newIndex < 0 ||
    newIndex >= queue.length ||
    newIndex === currentIndex
  ) {
    return null;
  }

  const temp = queue[currentIndex];

  queue[currentIndex] = queue[newIndex];
  queue[newIndex] = temp;

  updateAdminQueues(queues);

  return queue[newIndex];
}