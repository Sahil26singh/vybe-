import React, { useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import api from "@/lib/axios";
import { Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';

const EditProfile = () => {
    const imageRef = useRef();
    const { user, setAuthUser } = useApp();
    const [loading, setLoading] = useState(false);
    const [imageSelected, setImageSelected] = useState(false);
    const [imagePreview, setImagePreview] = useState(null);
    const [input, setInput] = useState({
        profilePhoto: user?.profilePicture,
        bio: user?.bio,
        gender: user?.gender
    });
    const navigate = useNavigate();

    const fileChangeHandler = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setInput({ ...input, profilePhoto: file });
            setImageSelected(true);
            // Show preview of the new photo
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const selectChangeHandler = (value) => {
        setInput({ ...input, gender: value });
    };

    const editProfileHandler = async () => {
        const formData = new FormData();
        formData.append("bio", input.bio || "");
        formData.append("gender", input.gender || "");
        if(input.profilePhoto && typeof input.profilePhoto !== "string"){
            formData.append("profilePhoto", input.profilePhoto);
        }
        try {
            setLoading(true);
            const res = await api.post('/api/v1/user/edit/profile', formData,{
                headers:{
                    'Content-Type':'multipart/form-data'
                },
                withCredentials:true
            });
            if(res.data.success){
                const updatedUserData = {
                    ...user,
                    bio:res.data.user?.bio,
                    profilePicture:res.data.user?.profilePicture,
                    gender:res.data.user?.gender
                };
                setAuthUser(updatedUserData);
                navigate(`/profile/${user?._id}`);
                toast.success(res.data.message);
            }

        } catch (error) {
            console.log(error);
            toast.error(error?.response?.data?.message || 'Update failed');
        } finally{
            setLoading(false);
        }
    };

    return (
        <div className='flex max-w-2xl mx-auto px-4 sm:px-6 lg:pl-10'>
            <section className='flex flex-col gap-6 w-full my-8'>
                <div className='flex items-center justify-between'>
                    <h1 className='font-bold text-xl'>Edit Profile</h1>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/profile/${user?._id}`)}
                        className='text-blue-500 hover:text-blue-700 flex items-center gap-1 text-sm'
                    >
                        <ExternalLink className='h-4 w-4' />
                        View my profile
                    </Button>
                </div>

                <div className='flex items-center justify-between bg-gray-100 rounded-xl p-4'>
                    <div className='flex items-center gap-3'>
                        <Avatar>
                            {/* Show preview of newly selected image, else current picture */}
                            <AvatarImage src={imagePreview || user?.profilePicture} alt="post_image" />
                            <AvatarFallback>{(user?.username||"X").slice(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className='font-bold text-sm'>{user?.username}</h1>
                            <span className='text-gray-600 text-sm'>{user?.bio || 'Bio here...'}</span>
                        </div>
                    </div>
                    <input ref={imageRef} onChange={fileChangeHandler} type='file' accept='image/*' className='hidden' />
                    <Button
                        onClick={() => imageRef?.current.click()}
                        className={`h-8 flex items-center gap-1 transition-all duration-200 ${
                            imageSelected
                                ? 'bg-green-100 text-green-700 border border-green-400 hover:bg-green-200'
                                : 'bg-[#0095F6] text-white hover:bg-[#318bc7]'
                        }`}
                    >
                        {imageSelected && <CheckCircle2 className='h-4 w-4 text-green-600' />}
                        {imageSelected ? 'Photo selected ✓' : 'Change photo'}
                    </Button>
                </div>

                <div>
                    <h1 className='font-bold text-xl mb-2'>Bio</h1>
                    <Textarea value={input.bio} onChange={(e) => setInput({ ...input, bio: e.target.value })} name='bio' className="focus-visible:ring-transparent" />
                </div>
                <div>
                    <h1 className='font-bold mb-2'>Gender</h1>
                    <Select defaultValue={input.gender} onValueChange={selectChangeHandler}>
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
                <div className='flex justify-end'>
                    {
                        loading ? (
                            <Button className='w-fit bg-[#0095F6] hover:bg-[#2a8ccd]'>
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                Please wait
                            </Button>
                        ) : (
                            <Button onClick={editProfileHandler} className='w-fit bg-[#0095F6] hover:bg-[#2a8ccd]'>Submit</Button>
                        )
                    }
                </div>
            </section>
        </div>
    );
};

export default EditProfile;