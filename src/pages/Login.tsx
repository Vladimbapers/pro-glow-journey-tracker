import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { User, Mail, Lock, Dumbbell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] bg-gradient-to-b from-purple-50 to-white flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-purple-200 shadow-xl animate-fade-in fitness-card">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-proglo-purple to-purple-400"></div>
        <CardHeader className="space-y-4 text-center pb-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-purple-50 flex items-center justify-center mb-2 border-2 border-purple-200">
            <Dumbbell className="h-8 w-8 text-proglo-purple" strokeWidth={2.5} />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-gray-800">Welcome Back</CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              Continue your fitness journey with Pro-Glo
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-2 px-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center text-gray-700">
                      <Mail className="h-4 w-4 mr-2 text-proglo-purple" />
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="your.email@example.com" className="border-purple-100 focus:border-proglo-purple focus:ring-proglo-purple/20 h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center text-gray-700">
                      <Lock className="h-4 w-4 mr-2 text-proglo-purple" />
                      Password
                    </FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" className="border-purple-100 focus:border-proglo-purple focus:ring-proglo-purple/20 h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-gradient-to-r from-proglo-purple to-purple-600 hover:from-proglo-dark-purple hover:to-purple-700 h-11 font-medium" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Log in'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 bg-gray-50 border-t border-purple-100 rounded-b-xl p-8">
          <div className="text-center text-sm">
            Don't have an account? <Link to="/register" className="text-proglo-purple font-medium hover:underline">Register</Link>
          </div>
          <div className="text-center text-sm">
            <Link to="/admin-login" className="text-gray-500 hover:text-proglo-purple hover:underline flex items-center justify-center">
              <User className="h-3 w-3 mr-1" />
              Admin Login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
