import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

describe('Button', () => {
  it('renders', () => {
    render(
      <Button
      myFunction={() => jest.fn()}
        title={'test'}
      />
    )

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('has onClick function', () => {
    const handleOnClick = jest.fn()
    render(
      <Button
        myFunction={handleOnClick}
        name={'test'}
      />
    )

    const button = screen.getByRole('button')
    userEvent.click(button)
    expect(handleOnClick).toHaveBeenCalled()
  })
})