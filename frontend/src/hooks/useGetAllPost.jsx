import { useApp } from "@/context/AppContext";
import api from "@/lib/axios";
import { useEffect } from "react";

const useGetAllPost = () => {
    const { setPosts } = useApp();
    useEffect(() => {
        const fetchAllPost = async () => {
            try {
                const res = await api.get('/api/v1/post/all', { withCredentials: true });
                if (res.data.success) { 
                    setPosts(res.data.posts);
                }
            } catch (error) {
                console.log(error);
            }
        };
        fetchAllPost();
    }, []);
};
export default useGetAllPost;