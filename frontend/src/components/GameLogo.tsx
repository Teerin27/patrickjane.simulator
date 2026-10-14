export default function GameLogo() {
  return (
    <div className="flex flex-col items-center gap-[3px] text-center">
      {/* one line when the window is landscape, stacked when it is too narrow for 14 glyphs at 16px */}
      <div className="flex flex-col items-center gap-[3px] landscape:flex-row landscape:items-baseline">
        {/* <wbr> lets the name wrap into Patric / Jane on very narrow phones instead of being clipped */}
        <h1 className="logo text-[16px] leading-[16px]">
          Patric
          <wbr />
          Jane
        </h1>
        <p className="h ink-shadow text-paper-100">.SIM</p>
      </div>
      <p className="label ink-shadow text-paper-300">A 1940s noir interrogation game</p>
    </div>
  )
}
