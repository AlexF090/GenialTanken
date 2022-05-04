import React from 'react';

const OpeningTimes = ({ currentStation }) => {
  const openingTimesJson = currentStation.openingtimes_json;

  return (
    <>
      {Object.keys(openingTimesJson).length === 0
        ? 'Uns liegen leider keine Informationen zu den Öffnungzeiten dieser Tankstelle vor'
        : 'Hier liegen Öffnungszeiten der Tankstelle vor.'}
    </>
  );
};

export default OpeningTimes;
