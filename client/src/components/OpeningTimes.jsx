import React from 'react';

function OpeningTimes({ currentStation }) {
  const openingtimesJson = currentStation.openingtimes_json;

  const convertOpeningTimes = () => {
    if (Object.keys(openingtimesJson).length === 0) {
      return <>Uns liegen leider keine Informationen zu den Öffnungzeiten dieser Tankstelle vor</>;
    } else return <>Hier liegen Öffnungszeiten der Tankstelle vor.</>;
  };

  return <>{convertOpeningTimes()}</>;
}

export default OpeningTimes;
