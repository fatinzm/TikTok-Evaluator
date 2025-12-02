
import React from 'react';
import { Button } from "@/components/ui/button";
import { Link, useLocation } from 'react-router-dom';
import { Video, Search, Home, Compass } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-grotesk">Faircado TikTok Tools</h1>
          
          <div className="flex gap-2">
            <Button
              asChild
              variant={location.pathname === '/' ? 'default' : 'outline'}
              size="sm"
            >
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Content Types
              </Link>
            </Button>

            <Button
              asChild
              variant={location.pathname === '/validator' ? 'default' : 'outline'}
              size="sm"
            >
              <Link to="/validator">
                <Video className="h-4 w-4 mr-2" />
                Validator
              </Link>
            </Button>
            
            <Button
              asChild
              variant={location.pathname === '/scraper' ? 'default' : 'outline'}
              size="sm"
            >
              <Link to="/scraper">
                <Search className="h-4 w-4 mr-2" />
                Scraper
              </Link>
            </Button>
            
            <Button
              asChild
              variant={location.pathname === '/database' ? 'default' : 'outline'}
              size="sm"
            >
              <Link to="/database">
                <Compass className="h-4 w-4 mr-2" />
                Explore
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
