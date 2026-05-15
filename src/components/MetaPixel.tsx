import Script from "next/script"

type MetaPixelProps = {
  pixelId: string | null
}

export function MetaPixel({ pixelId }: MetaPixelProps) {
  if (pixelId == null || pixelId.trim() === "") {
    return null
  }

  const id = pixelId.trim()

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');
        `.trim()}
      </Script>
      <noscript>
        <img
          alt=""
          height="1"
          width="1"
          className="hidden"
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(id)}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  )
}
