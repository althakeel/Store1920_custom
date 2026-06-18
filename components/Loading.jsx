'use client'

const Loading = ({ inline = false, className = '' }) => {
    const wrapperClass = inline
        ? `flex items-center justify-center py-16 ${className}`
        : `flex items-center justify-center h-screen ${className}`;

    return (
        <div className={wrapperClass}>
            <div className='w-11 h-11 rounded-full border-[3px] border-gray-300 border-t-green-500 animate-spin'></div>
        </div>
    )
}

export default Loading