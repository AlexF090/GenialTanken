import React from 'react';

function OpeningTimes({ currentStation }) {
  const openingtimesJson = currentStation.openingtimes_json;
  // const openingTimes = currentStation.openingtimes_json.openingTimes;

  const convertOpeningTimes = () => {
    // console.log(`Test: ${Object.keys(currentStation.openingtimes_json.openingTimes[0])}`);
    if (Object.keys(openingtimesJson).length === 0) {
      return (
        <p>Uns liegen leider keine Informationen zu den Öffnungzeiten dieser Tankstelle vor</p>
      );
    } else return <p>Hier liegen Öffnungszeiten der Tankstelle vor.</p>;
  };

  return <p>{convertOpeningTimes()}</p>;
}

export default OpeningTimes;
