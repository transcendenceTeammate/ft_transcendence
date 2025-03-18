const getRandomAvatar = () => 
{
    const avatars = [
        "../../public/avatars/gallery_10pics/book_nerdie.png",
        "../../public/avatars/gallery_10pics/coder.webp",
        "../../public/avatars/gallery_10pics/gentleman.webp",
        "../../public/avatars/gallery_10pics/girlboss.webp",
        "../../public/avatars/gallery_10pics/Heine.webp",
        "../../public/avatars/gallery_10pics/lab_girlie.webp",
        "../../public/avatars/gallery_10pics/nun.webp",
        "../../public/avatars/gallery_10pics/princess.webp",
        "../../public/avatars/gallery_10pics/punk.webp",
        "../../public/avatars/gallery_10pics/sherlock.webp",
        "../../public/avatars/gallery_10pics/sk8er.webp"
    ]

    const randomAvatarIndex = Math.floor(Math.random() * avatars.length)
    console.log(`random avatar is: ${avatars[randomAvatarIndex]}`)
    return avatars[randomAvatarIndex];
}

export {getRandomAvatar};