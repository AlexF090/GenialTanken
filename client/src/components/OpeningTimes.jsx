import React from 'react';

function OpeningTimes({ currentStation }) {
  const convertOpeningTimes = () => {
    // console.log(`Test: ${Object.keys(currentStation.openingtimes_json.openingTimes[0])}`);
    if (Object.keys(currentStation.openingtimes_json).length === 0) {
      return (
        <p>Uns liegen leider keine Informationen zu den Öffnungzeiten dieser Tankstelle vor</p>
      );
    } else return <p>Hier liegen Tankstellenpreise vor.</p>;
  };

  return <div>{convertOpeningTimes()}</div>;
}

export default OpeningTimes;
