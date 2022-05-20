import React from 'react';

function Distance({ distance }) {
  function division(x, y) {
    const distanceDevision = x / y;
    const distanceDevisionToString = distanceDevision.toString();
    if (distanceDevisionToString.length >= 6) {
      return distanceDevisionToString.substring(0, 5);
    } else {
      return distanceDevisionToString.substring(0, 4);
    }
  }

  return <>{division(distance, 1000)} km</>;
}

export default Distance;
