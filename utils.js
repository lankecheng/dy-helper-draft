export const parseDuration = (durationStr) => {
  //05:29
  if (!durationStr) return 0
  const elments = durationStr.trim().split(':')
  console.log(elments)
  let seconds = 0
  for (let i = 0; i < elments.length; i++) {
    seconds += parseInt(elments[i]) * Math.pow(60, elments.length - i - 1)
  }
  return seconds
}
