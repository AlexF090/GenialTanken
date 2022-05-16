import React from 'react'

function GeoButton({myFunction, buttonTitle}) {
  return (
    <button onClick={myFunction}>{buttonTitle}</button>
  )
}

export default GeoButton